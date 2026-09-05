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

// PATCH /api/cart/[id] 修改数量 { quantity } 或勾选状态 { checked }（至少传一个）
const updateBodySchema = z
  .object({
    quantity: z.coerce.number().int().min(1, "数量至少为 1").max(99, "单件商品最多 99 件").optional(),
    checked: z.boolean().optional(),
  })
  .refine((data) => data.quantity !== undefined || data.checked !== undefined, {
    message: "至少提供 quantity 或 checked 之一",
  });

export async function PATCH(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const item = await getOwnedItem(idSchema.parse(id), user.id);
    const body = updateBodySchema.parse(await request.json());

    const updated = await prisma.cartItem.update({
      where: { id: item.id },
      data: {
        ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
        ...(body.checked !== undefined ? { checked: body.checked } : {}),
      },
      include: { product: { include: { category: true } } },
    });

    return ok(updated, body.checked !== undefined ? "勾选状态已更新" : "数量已更新");
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
