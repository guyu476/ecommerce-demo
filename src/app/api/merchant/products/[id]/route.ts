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
    const body = updateBodySchema.parse(await request.json());

    const product = await prisma.product.update({
      where: { id: idSchema.parse(id) },
      data: body,
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
