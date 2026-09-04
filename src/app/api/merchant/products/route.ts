import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const productBodySchema = z.object({
  name: z.string().trim().min(1, "商品名不能为空").max(200),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0, "价格不能为负数"),
  stock: z.coerce.number().int().min(0).default(0),
  categoryId: z.coerce.number().int().positive(),
  status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]).default("DRAFT"),
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
      include: { category: true, seller: { select: { nickname: true } } },
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

    const product = await prisma.product.create({
      data: {
        ...body,
        images: body.images ? JSON.stringify(body.images) : undefined,
        sellerId: user.role === "MERCHANT" ? user.id : null,
      },
      include: { category: true },
    });

    return ok(product, "商品已创建");
  });
}
