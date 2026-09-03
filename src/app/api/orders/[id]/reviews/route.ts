import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, isPrismaError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/orders/[id]/reviews 评价订单商品（已发货/已完成可评，一单一商品一条）
type Context = RouteContext<"/api/orders/[id]/reviews">;

const idSchema = z.coerce.number().int().positive();

const reviewBodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        rating: z.coerce.number().int().min(1, "请打 1-5 星").max(5, "最高 5 星"),
        content: z.string().trim().min(1, "评价内容不能为空").max(500, "评价最多 500 字"),
      }),
    )
    .min(1, "至少评价一件商品"),
});

export async function POST(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const orderId = idSchema.parse(id);
    const body = reviewBodySchema.parse(await request.json());

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.userId !== user.id) {
      throw new ApiError("订单不存在", 40406, 404);
    }
    if (order.status !== "SHIPPED" && order.status !== "COMPLETED") {
      throw new ApiError("订单完成后才能评价", 40906, 409);
    }

    // 校验商品都属于该订单
    const orderProductIds = new Set(order.items.map((item) => item.productId));
    for (const item of body.items) {
      if (!orderProductIds.has(item.productId)) {
        throw new ApiError("评价的商品不在该订单中", 40004, 400);
      }
    }

    try {
      await prisma.review.createMany({
        data: body.items.map((item) => ({
          orderId,
          userId: user.id,
          productId: item.productId,
          rating: item.rating,
          content: item.content,
        })),
      });
    } catch (error) {
      // 一单一商品一条评价：重复评价走唯一约束拦截
      if (isPrismaError(error, "P2002")) {
        throw new ApiError("部分商品已评价过，请刷新查看", 40907, 409);
      }
      throw error;
    }

    const reviews = await prisma.review.findMany({ where: { orderId } });
    return ok(reviews, "评价成功");
  });
}
