// Next.js 服务器实例启动时执行一次：注册订单超时自动取消的定时任务
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOrderTimeoutJob } = await import("@/lib/order-timeout");
    startOrderTimeoutJob();
  }
}
