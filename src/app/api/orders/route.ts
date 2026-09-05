import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, isPrismaError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { generateOrderNo, hashRequest } from "@/lib/order";
import { prisma } from "@/lib/prisma";

// ============ POST /api/orders 下单（从购物车结算） ============
// 契约：必须携带客户端生成的幂等键请求头 Idempotency-Key，重试时复用同一 key。
// 服务端用唯一约束原子抢占实现幂等：同键同体返回已有订单（重放），同键异体响亮报 422。
// 优惠券：可选 userCouponId（UNUSED、未过期、满足门槛），事务内核销并记录抵扣金额。

const createBodySchema = z.object({
  recipientName: z.string().trim().min(1, "收货人不能为空").max(50, "收货人最多 50 字"),
  recipientPhone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  shippingAddress: z.string().trim().min(5, "收货地址至少 5 个字").max(500, "地址最多 500 字"),
  userCouponId: z.coerce.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();

    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 80) {
      throw new ApiError("缺少请求头 Idempotency-Key（客户端生成一次，重试复用）", 40002, 400);
    }

    const body = createBodySchema.parse(await request.json());
    const requestHash = hashRequest(body);

    try {
      const order = await prisma.$transaction(async (tx) => {
        // 1. 原子抢占幂等键：并发由唯一约束裁决（先查后插是竞态，不是防护）
        await tx.idempotencyKey.create({
          data: { key: idempotencyKey, userId: user.id, requestHash },
        });

        // 2. 读取当前用户购物车
        const cartItems = await tx.cartItem.findMany({
          where: { userId: user.id },
          include: { product: true },
        });
        if (cartItems.length === 0) {
          throw new ApiError("购物车为空，无法下单", 40003, 400);
        }

        // 3. 逐项条件更新扣库存（防超卖），任一失败整体回滚
        const snapshots: { productId: number; name: string; price: string; quantity: number }[] =
          [];
        for (const item of cartItems) {
          if (item.product.status !== "ON_SALE") {
            throw new ApiError(`商品「${item.product.name}」已下架`, 40902, 409);
          }
          const updated = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity }, sales: { increment: item.quantity } },
          });
          if (updated.count === 0) {
            throw new ApiError(`商品「${item.product.name}」库存不足`, 40902, 409);
          }
          snapshots.push({
            productId: item.productId,
            name: item.product.name,
            price: String(item.product.price),
            quantity: item.quantity,
          });
        }

        // 4. 优惠券核销：UNUSED + 未过期 + 满门槛，任一不满足则整体回滚
        const totalAmount = snapshots.reduce(
          (sum, item) => sum + Number(item.price) * item.quantity,
          0,
        );
        let discountAmount = 0;
        let userCouponId: number | undefined;
        if (body.userCouponId) {
          const userCoupon = await tx.userCoupon.findUnique({
            where: { id: body.userCouponId },
            include: { coupon: true },
          });
          if (!userCoupon || userCoupon.userId !== user.id) {
            throw new ApiError("优惠券不存在", 40404, 404);
          }
          if (userCoupon.status !== "UNUSED") {
            throw new ApiError("优惠券已被使用", 40906, 409);
          }
          if (userCoupon.coupon.expiresAt < new Date()) {
            throw new ApiError("优惠券已过期", 40906, 409);
          }
          if (Number(userCoupon.coupon.threshold) > totalAmount) {
            throw new ApiError(
              `该券满 ${Number(userCoupon.coupon.threshold)} 元可用，还差一点哦`,
              40906,
              409,
            );
          }
          const claimed = await tx.userCoupon.updateMany({
            where: { id: userCoupon.id, status: "UNUSED" },
            data: { status: "USED", usedAt: new Date() },
          });
          if (claimed.count === 0) {
            throw new ApiError("优惠券已被使用", 40906, 409);
          }
          discountAmount = Number(userCoupon.coupon.discount);
          userCouponId = userCoupon.id;
        }

        // 5. 创建订单 + 条目快照（金额按数据库现价合计；应付 = 合计 - 券抵扣）
        const order = await tx.order.create({
          data: {
            orderNo: generateOrderNo(),
            userId: user.id,
            totalAmount,
            discountAmount,
            recipientName: body.recipientName,
            recipientPhone: body.recipientPhone,
            shippingAddress: body.shippingAddress,
            items: {
              create: snapshots.map((item) => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
              })),
            },
          },
          include: { items: true },
        });

        // 6. 绑定用掉的券（一单一券，唯一约束兜底）
        if (userCouponId) {
          await tx.userCoupon.update({
            where: { id: userCouponId },
            data: { orderId: order.id },
          });
        }

        // 7. 清空已结算的购物车
        await tx.cartItem.deleteMany({ where: { userId: user.id } });

        // 8. 幂等键绑定订单，供后续重放
        await tx.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: { orderId: order.id },
        });

        return order;
      });

      return ok(order, "下单成功");
    } catch (error) {
      // 幂等键冲突：并发或重试时由唯一约束裁决，走重放或响亮报错
      if (isPrismaError(error, "P2002")) {
        const existing = await prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });
        if (existing && existing.userId !== user.id) {
          throw new ApiError("幂等键已被其他用户占用", 40903, 409);
        }
        if (existing && existing.requestHash !== requestHash) {
          throw new ApiError("同一幂等键被用于不同的下单内容", 42201, 422);
        }
        if (existing?.orderId) {
          const order = await prisma.order.findUnique({
            where: { id: existing.orderId },
            include: { items: true },
          });
          return ok(order, "订单已存在（幂等重放）");
        }
      }
      throw error;
    }
  });
}

// ============ GET /api/orders 当前用户订单分页列表 ============
// 查询参数：page、pageSize、status（订单状态或 all）、filter=unreviewed（待评价）

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z
    .enum(["PENDING_PAYMENT", "PAID", "SHIPPED", "COMPLETED", "CANCELLED", "all"])
    .default("all"),
  filter: z.enum(["all", "unreviewed"]).default("all"),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where = {
      userId: user.id,
      ...(query.status !== "all" ? { status: query.status } : {}),
      // 待评价：已发货/已完成且还没有任何评价
      ...(query.filter === "unreviewed"
        ? {
            status: { in: ["SHIPPED", "COMPLETED"] as ("SHIPPED" | "COMPLETED")[] },
            reviews: { none: {} },
          }
        : {}),
    };

    const [total, list] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          items: true,
          reviews: { select: { productId: true } },
          coupon: { include: { coupon: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return ok({ list, total, page: query.page, pageSize: query.pageSize });
  });
}
