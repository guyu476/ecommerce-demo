import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { applySkus, skusSchema, specsSchema } from "@/lib/product-sku";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const productBodySchema = z.object({
  name: z.string().trim().min(1, "商品名不能为空").max(200),
  description: z.string().trim().max(2000).optional(),
  // 有 SKU 时价格/库存由 SKU 聚合维护，这两个字段可省略
  price: z.coerce.number().min(0, "价格不能为负数").optional(),
  stock: z.coerce.number().int().min(0).default(0),
  categoryId: z.coerce.number().int().positive(),
  status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]).default("DRAFT"),
  // 规格与 SKU：可选；skus 非空则商品启用多规格（聚合价格/库存），空数组=清空规格退回单品
  specs: specsSchema.optional(),
  skus: skusSchema.optional(),
  // 商品图片：客户端压缩的 data URL 或本站静态路径（/products/...），最多 6 张
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

// GET /api/merchant/products 我的商品列表（商家看自己的，管理员看全部）
export async function GET() {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");

    const products = await prisma.product.findMany({
      where: user.role === "MERCHANT" ? { sellerId: user.id } : {},
      include: {
        category: true,
        seller: { select: { nickname: true } },
        skus: { orderBy: { id: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(products);
  });
}

// POST /api/merchant/products 上架新商品（商家挂自己名下；管理员挂平台）
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");
    const body = productBodySchema.parse(await request.json());

    const categoryExists = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });
    if (!categoryExists) {
      throw new ApiError("分类不存在", 40402, 404);
    }
    const hasSkus = body.skus !== undefined && body.skus.length > 0;
    if (!hasSkus && (body.price === undefined || body.price <= 0)) {
      throw new ApiError("价格必须大于 0", 42202, 422);
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: body.name,
          description: body.description,
          price: body.price ?? 0,
          stock: body.stock,
          categoryId: body.categoryId,
          status: body.status,
          images: body.images ? JSON.stringify(body.images) : undefined,
          sellerId: user.role === "MERCHANT" ? user.id : null,
        },
        include: { category: true },
      });

      if (body.skus !== undefined && body.specs !== undefined) {
        await applySkus(tx, created.id, body.specs, body.skus);
      }

      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: { category: true, skus: { orderBy: { id: "asc" } } },
      });
    });

    return ok(product, "商品已创建");
  });
}
