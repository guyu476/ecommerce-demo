import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, isPrismaError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { generateOrderNo, groupByShop, hashRequest } from "@/lib/order";
import { prisma } from "@/lib/prisma";

// ============ POST /api/orders 下单（从购物车结算，跨店自动拆单） ============
// 契约：必须携带客户端生成的幂等键请求头 Idempotency-Key，重试时复用同一 key。
// 服务端用唯一约束原子抢占实现幂等：同键同体返回已有订单（重放），同键异体响亮报 422。
// 拆单：勾选商品按商家分组，一店一笔订单（checkoutGroupId 同组），各自独立发货/退款/取消。
// 优惠券落在其作用域的子单上：平台券→金额最大的子单，店铺券→该店子单。

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
      const orders = await prisma.$transaction(async (tx) => {
        // 1. 原子抢占幂等键：并发由唯一约束裁决（先查后插是竞态，不是防护）
        await tx.idempotencyKey.create({
          data: { key: idempotencyKey, userId: user.id, requestHash },
        });

        // 2. 读取当前用户购物车（只结算勾选中的条目）
        const cartItems = await tx.cartItem.findMany({
          where: { userId: user.id, checked: true },
          include: { product: true },
        });
        if (cartItems.length === 0) {
          throw new ApiError("请先勾选要结算的商品", 40003, 400);
        }

        // 3. 逐项条件更新扣库存（防超卖），任一失败整体回滚
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
        }

        // 4. 按商家拆单分组（一店一笔；平台自营归 0 号组）
        const groups = groupByShop(cartItems);
        const groupTotals = new Map<number, number>();
        for (const [sellerId, items] of groups) {
          const total = items.reduce(
            (sum, item) => sum + Number(item.product.price) * item.quantity,
            0,
          );
          groupTotals.set(sellerId, total);
        }

        // 5. 优惠券核销：UNUSED + 未过期 + 满门槛，落在其作用域的子单上
        let discountTargetSeller: number | null | undefined; // undefined=未用券
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

          const threshold = Number(userCoupon.coupon.threshold);
          if (userCoupon.coupon.ownerId === null) {
            // 平台券：落在金额最大的子单上，按该子单合计校验门槛
            let bestSeller: number | null | undefined;
            let bestTotal = -1;
            for (const [sellerId, total] of groupTotals) {
              if (total > bestTotal) {
                bestTotal = total;
                bestSeller = sellerId === 0 ? null : sellerId;
              }
            }
            if (bestSeller === undefined || threshold > bestTotal) {
              throw new ApiError(
                `该券满 ${threshold} 元可用（拆单后单笔最高 ${Math.max(0, bestTotal).toFixed(2)} 元）`,
                40906,
                409,
              );
            }
            discountTargetSeller = bestSeller;
          } else {
            // 店铺券：必须落在该店子单上，按该店小计校验门槛
            const shopTotal = groupTotals.get(userCoupon.coupon.ownerId);
            if (shopTotal === undefined) {
              throw new ApiError("该券是店铺券，勾选的商品里没有这个店铺的", 40906, 409);
            }
            if (threshold > shopTotal) {
              throw new ApiError(
                `该券限店铺商品满 ${threshold} 元可用（当前本店小计 ${shopTotal.toFixed(2)} 元）`,
                40906,
                409,
              );
            }
            discountTargetSeller = userCoupon.coupon.ownerId;
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

        // 6. 每店创建一笔订单（同组共享 checkoutGroupId = 幂等键值）
        const createdOrders = [];
        for (const [sellerId, items] of groups) {
          const totalAmount = groupTotals.get(sellerId)!;
          const orderDiscount =
            discountTargetSeller !== undefined && sellerId === (discountTargetSeller ?? 0)
              ? discountAmount
              : 0;

          const order = await tx.order.create({
            data: {
              orderNo: generateOrderNo(),
              checkoutGroupId: idempotencyKey,
              userId: user.id,
              totalAmount,
              discountAmount: orderDiscount,
              recipientName: body.recipientName,
              recipientPhone: body.recipientPhone,
              shippingAddress: body.shippingAddress,
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  name: item.product.name,
                  price: String(item.product.price),
                  quantity: item.quantity,
                })),
              },
            },
            include: { items: true },
          });
          createdOrders.push(order);

          // 用掉的券绑定其子单（orderId 唯一，一券一单）
          if (userCouponId && orderDiscount > 0) {
            await tx.userCoupon.update({
              where: { id: userCouponId },
              data: { orderId: order.id },
            });
          }
        }

        // 7. 清空已结算的购物车（只删勾选结算的条目，未勾选的保留）
        await tx.cartItem.deleteMany({ where: { userId: user.id, checked: true } });

        // 8. 幂等键绑定首单，供后续重放（整组经 checkoutGroupId 取回）
        await tx.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: { orderId: createdOrders[0].id },
        });

        return createdOrders;
      });

      const splitHint =
        orders.length > 1 ? `，已按店铺拆成 ${orders.length} 笔订单分别发货` : "";
      return ok({ orders }, `下单成功${splitHint}`);
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
          const first = await prisma.order.findUnique({
            where: { id: existing.orderId },
            include: { items: true },
          });
          // 拆单组重放：取回同一 checkoutGroupId 的全部子单；老数据（无组）退回单笔
          const replayed = first?.checkoutGroupId
            ? await prisma.order.findMany({
                where: { checkoutGroupId: first.checkoutGroupId, userId: user.id },
                include: { items: true },
                orderBy: { id: "asc" },
              })
            : first
              ? [first]
              : [];
          return ok({ orders: replayed }, "订单已存在（幂等重放）");
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
