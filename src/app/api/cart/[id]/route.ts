import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 路由参数：/api/cart/[id] 中的 id 是购物车条目 ID
type Context = RouteContext<"/api/cart/[id]">;

const idSchema = z.coerce.number().int().positive();

async function getOwnedItem(itemId: number, userId: number) {
  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  // 不存在或不属于当前用户，一律按不存在处理（避免泄露他人数据）
  if (!item || item.userId !== userId) {
    throw new ApiError("购物车条目不存在", 40405, 404);
  }
  return item;
}

// PATCH /api/cart/[id] 修改数量 { quantity }
const updateBodySchema = z.object({
  quantity: z.coerce.number().int().min(1, "数量至少为 1").max(99, "单件商品最多 99 件"),
});

export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const item = await getOwnedItem(idSchema.parse(id), user.id);
    const body = updateBodySchema.parse(await request.json());

    const updated = await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: body.quantity },
      include: { product: { include: { category: true } } },
    });

    return ok(updated, "数量已更新");
  });
}

// DELETE /api/cart/[id] 移除条目
export async function DELETE(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const item = await getOwnedItem(idSchema.parse(id), user.id);

    await prisma.cartItem.delete({ where: { id: item.id } });
    return ok({ id: item.id }, "已移除");
  });
}
