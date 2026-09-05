import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============ 店铺（演示版：一人一店） ============
// GET /api/merchant/shop  我的店铺（没有则返回 null，前端引导创建）
// PUT /api/merchant/shop  创建/更新店铺；保存后把我名下商品挂到 shopId，保证店铺页可见

export const dynamic = "force-dynamic";

const shopBodySchema = z.object({
  name: z.string().trim().min(2, "店铺名至少 2 个字").max(100, "店铺名最多 100 字"),
  logo: z.string().trim().max(16, "请选择一个 emoji 作为店招").optional().default("🏪"),
  description: z.string().trim().max(500, "店铺简介最多 500 字").optional().default(""),
});

export async function GET() {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");
    const shop = await prisma.shop.findUnique({
      where: { ownerId: user.id },
      include: { _count: { select: { products: true } } },
    });
    return ok(
      shop
        ? {
            id: shop.id,
            name: shop.name,
            logo: shop.logo,
            description: shop.description,
            status: shop.status,
            productCount: shop._count.products,
          }
        : null,
    );
  });
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");
    const body = shopBodySchema.parse(await request.json());

    const shop = await prisma.shop.upsert({
      where: { ownerId: user.id },
      update: { name: body.name, logo: body.logo, description: body.description || null },
      create: {
        ownerId: user.id,
        name: body.name,
        logo: body.logo,
        description: body.description || null,
      },
    });

    // 商品归属店铺：创建/改名后同步一次，保证店铺页商品齐全
    await prisma.product.updateMany({
      where: { sellerId: user.id, shopId: null },
      data: { shopId: shop.id },
    });

    return ok(
      { id: shop.id, name: shop.name, logo: shop.logo, description: shop.description },
      "店铺已保存",
    );
  });
}
