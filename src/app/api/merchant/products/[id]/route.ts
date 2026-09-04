import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH/DELETE /api/merchant/products/[id] 商家改自己的商品，管理员改任何商品
type Context = RouteContext<"/api/merchant/products/[id]">;

const idSchema = z.coerce.number().int().positive();

const updateBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]).optional(),
  // 商品图片：整体替换（客户端压缩后的 data URL 数组）
  images: z
    .array(
      z
        .string()
        .max(400_000, "单张图片过大")
        .refine((v) => v.startsWith("data:image/"), {
          message: "仅支持图片 data URL",
        }),
    )
    .max(6, "最多 6 张图片")
    .optional(),
});

async function getOwnedProduct(productId: number, user: { id: number; role: string }) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new ApiError("商品不存在", 40401, 404);
  }
  // 管理员任意；商家仅限自己的商品
  if (user.role !== "ADMIN" && product.sellerId !== user.id) {
    throw new ApiError("商品不存在", 40401, 404);
  }
  return product;
}

export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");
    const { id } = await context.params;
    await getOwnedProduct(idSchema.parse(id), user);
    // images 数组单独处理（入库前序列化为 JSON 字符串）
    const { images, ...rest } = updateBodySchema.parse(await request.json());

    const product = await prisma.product.update({
      where: { id: idSchema.parse(id) },
      data: {
        ...rest,
        ...(images ? { images: JSON.stringify(images) } : {}),
      },
      include: { category: true },
    });
    return ok(product, "已更新");
  });
}

export async function DELETE(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");
    const { id } = await context.params;
    const productId = idSchema.parse(id);
    await getOwnedProduct(productId, user);

    await prisma.product.delete({ where: { id: productId } });
    return ok({ id: productId }, "已删除");
  });
}
