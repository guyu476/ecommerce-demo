// 重置演示订单状态：一笔已发货（待收货）、一笔已付款（待发货），保证后台始终有可操作订单
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // DEMO202609010002 回到已发货
  await prisma.order.updateMany({
    where: { orderNo: "DEMO202609010002" },
    data: { status: "SHIPPED" },
  });

  // 新增一笔已付款演示单（待发货，含商家商品）
  const items = [
    { name: "星耀 X7 Pro 5G 手机 12GB+256GB", price: 3499, quantity: 1 },
    { name: "机械键盘 87 键 红轴", price: 329, quantity: 1 },
  ];
  const first = await prisma.product.findFirst({
    where: { name: items[0].name },
    select: { id: true },
  });
  const second = await prisma.product.findFirst({
    where: { name: items[1].name },
    select: { id: true },
  });
  const demo = await prisma.user.findUnique({
    where: { email: "demo@example.com" },
    select: { id: true },
  });
  if (!first || !second || !demo) throw new Error("前置数据缺失");

  await prisma.order.upsert({
    where: { orderNo: "DEMO202609010003" },
    update: { status: "PAID" },
    create: {
      orderNo: "DEMO202609010003",
      userId: demo.id,
      status: "PAID",
      totalAmount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      recipientName: "演示用户",
      recipientPhone: "13800138000",
      shippingAddress: "浙江省杭州市西湖区文三路 100 号",
      items: {
        create: items.map((item) => ({
          productId: item.name === items[0].name ? first.id : second.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    },
  });

  const counts = await prisma.order.groupBy({ by: ["status"], _count: true });
  console.log("订单状态分布:", counts.map((c) => `${c.status}:${c._count}`).join(" "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
