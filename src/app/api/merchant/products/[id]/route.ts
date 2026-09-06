import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { applySkus, skusSchema, specsSchema } from "@/lib/product-sku";
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
  // 规格与 SKU：一起提交即全量替换（skus=[] 表示清空规格退回单品）
  specs: specsSchema.optional(),
  skus: skusSchema.optional(),
  // 商品图片：整体替换（data URL 或本站静态路径）
  images: z
    .array(
      z
        .string()
        .max(400_000, "单张图片过大")
        .refine((v) => v.startsWith("data:image/") || v.startsWith("/"), {
          message: "仅支持图片 data URL 或本站图片路径",
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
    const product = await getOwnedProduct(idSchema.parse(id), user);
    const { specs, skus, images, price, stock, ...rest } = updateBodySchema.parse(
      await request.json(),
    );

    const hasSkus = product.specs != null;
    if (skus !== undefined && specs === undefined) {
      throw new ApiError("提交 SKU 时必须同时携带规格定义 specs", 42202, 422);
    }
    // 已启用 SKU 的商品，单独改 price/stock 会破坏聚合，必须通过提交规格组合修改
    if (skus === undefined && hasSkus && (price !== undefined || stock !== undefined)) {
      throw new ApiError("该商品已启用规格 SKU，价格/库存请通过提交规格组合修改", 40908, 409);
    }
    // 清空规格退回单品时，必须给出新的单品价格
    if (skus !== undefined && skus.length === 0 && (price === undefined || price <= 0)) {
      throw new ApiError("清空规格时必须提供有效的单品价格", 42202, 422);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (skus !== undefined && specs !== undefined) {
        await applySkus(tx, product.id, specs, skus);
      }
      return tx.product.update({
        where: { id: product.id },
        data: {
          ...rest,
          // 价格/库存归属规则：提交 SKU 时由聚合维护；无规格单品可直改；清空规格时用表单值
          ...(price !== undefined && (skus === undefined || skus.length === 0)
            ? { price }
            : {}),
          ...(stock !== undefined && (skus === undefined || skus.length === 0)
            ? { stock }
            : {}),
          ...(images ? { images: JSON.stringify(images) } : {}),
        },
        include: { category: true, skus: { orderBy: { id: "asc" } } },
      });
    });

    return ok(updated, "已更新");
  });
}

// DELETE /api/merchant/products/[id] 删除商品
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
