import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { parseSkuSpecs, skuSpecText } from "@/lib/sku";
import { prisma } from "@/lib/prisma";

// GET /api/cart 当前用户购物车列表（含商品信息与合计）
// ?checkedOnly=1 只返回勾选中的条目（结算页用），合计也只算勾选项
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const checkedOnly = request.nextUrl.searchParams.get("checkedOnly") === "1";

    const items = await prisma.cartItem.findMany({
      where: { userId: user.id, ...(checkedOnly ? { checked: true } : {}) },
      orderBy: { updatedAt: "desc" },
      include: { product: { include: { category: true } } },
    });

    // SKU 现价：有规格的条目按当前 SKU 价格（金额合计/展示均用现价）
    const skuIds = items.filter((item) => item.skuId > 0).map((item) => item.skuId);
    const skus = skuIds.length ? await prisma.sku.findMany({ where: { id: { in: skuIds } } }) : [];
    const skuById = new Map(skus.map((sku) => [sku.id, sku]));
    const itemsWithPrice = items.map((item) => ({
      ...item,
      unitPrice: String(
        item.skuId > 0 ? (skuById.get(item.skuId)?.price ?? item.product.price) : item.product.price,
      ),
    }));

    // 合计：数量与金额（Decimal -> number 求和）
    const totalQuantity = itemsWithPrice.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = itemsWithPrice.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    return ok({ items: itemsWithPrice, totalQuantity, totalPrice });
  });
}

// PATCH /api/cart 全选 / 全不选 { checked }（作用于当前用户全部条目）
const checkAllSchema = z.object({
  checked: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = checkAllSchema.parse(await request.json());

    const result = await prisma.cartItem.updateMany({
      where: { userId: user.id },
      data: { checked: body.checked },
    });

    return ok({ updated: result.count }, body.checked ? "已全选" : "已取消全选");
  });
}

// POST /api/cart 加入购物车 { productId, skuId?, quantity? }；已存在（同商品同 SKU）则累加数量
const addBodySchema = z.object({
  productId: z.coerce.number().int().positive(),
  skuId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = addBodySchema.parse(await request.json());

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      include: { skus: body.skuId ? { where: { id: body.skuId } } : false },
    });
    if (!product || product.status !== "ON_SALE") {
      throw new ApiError("商品不存在或已下架", 40401, 404);
    }

    // SKU 归属与库存判定
    let skuId = 0;
    let skuSpecs: string | null = null;
    let stockCap = product.stock;
    if (product.specs != null) {
      const sku = body.skuId ? product.skus[0] : undefined;
      if (!sku) {
        throw new ApiError("请先选择商品规格", 42202, 422);
      }
      skuId = sku.id;
      skuSpecs = skuSpecText(parseSkuSpecs(sku.specs));
      stockCap = sku.stock;
    } else if (body.skuId) {
      throw new ApiError("该商品无规格，无需选择 SKU", 42202, 422);
    }
    if (stockCap <= 0) {
      throw new ApiError("商品库存不足", 40902, 409);
    }

    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId_skuId: { userId: user.id, productId: body.productId, skuId } },
    });

    const quantity = Math.min(
      existing ? existing.quantity + body.quantity : body.quantity,
      stockCap,
      99,
    );

    const item = await prisma.cartItem.upsert({
      where: { userId_productId_skuId: { userId: user.id, productId: body.productId, skuId } },
      update: { quantity, checked: true },
      create: {
        userId: user.id,
        productId: body.productId,
        skuId,
        skuSpecs,
        quantity,
      },
      include: { product: { include: { category: true } } },
    });

    return ok(item, "已加入购物车");
  });
}
