import { prisma } from "@/lib/prisma";

// 订单超时自动取消：每分钟扫描过期的待付款订单，条件更新转 CANCELLED 并逐项释放库存。
// 挂载于 src/instrumentation.ts（服务器启动时注册一次，dev 热重载靠模块级开关防重复）。
// 真实接入时替换为延迟队列（RabbitMQ 死信 / Redis 过期通知），扫描兜底可保留。

let started = false;
const TICK_MS = 60 * 1000;
const BATCH = 50;

async function cancelExpiredOrders(): Promise<number> {
  const expired = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expireAt: { lt: new Date() } },
    select: { id: true },
    take: BATCH,
  });

  let cancelled = 0;
  for (const order of expired) {
    const done = await prisma.$transaction(async (tx) => {
      // 条件更新做状态机守卫：并发下（用户恰好同时支付）只有一个生效
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED" },
      });
      if (updated.count === 0) return false;

      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        // 有 SKU 的条目释放 SKU 库存（销量只在支付时增加，无需回退）
        if (item.skuId != null) {
          await tx.sku.update({
            where: { id: item.skuId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      return true;
    });
    if (done) cancelled += 1;
  }
  return cancelled;
}

export function startOrderTimeoutJob(): void {
  if (started) return;
  started = true;

  async function tick() {
    try {
      const cancelled = await cancelExpiredOrders();
      if (cancelled > 0) {
        console.log(`[order-timeout] 已自动取消 ${cancelled} 笔超时未支付订单并释放库存`);
      }
    } catch (error) {
      console.error("[order-timeout] 取消超时订单失败:", error);
    }
  }

  void tick();
  setInterval(tick, TICK_MS);
}
