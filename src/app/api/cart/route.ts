import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
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

    // 合计：数量与金额（Decimal -> number 求和）
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    );

    return ok({ items, totalQuantity, totalPrice });
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

// POST /api/cart 加入购物车 { productId, quantity? }；已存在则累加数量
const addBodySchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = addBodySchema.parse(await request.json());

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true, status: true, stock: true },
    });
    if (!product || product.status !== "ON_SALE") {
      throw new ApiError("商品不存在或已下架", 40401, 404);
    }

    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId: user.id, productId: body.productId } },
    });

    const quantity = existing
      ? Math.min(existing.quantity + body.quantity, product.stock)
      : Math.min(body.quantity, product.stock);

    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: user.id, productId: body.productId } },
      update: { quantity },
      create: { userId: user.id, productId: body.productId, quantity },
      include: { product: { include: { category: true } } },
    });

    return ok(item, "已加入购物车");
  });
}
