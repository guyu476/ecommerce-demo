// 临时脚本：列出全部订单，标记乱码收货人的（供删除确认）
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 乱码特征：UTF-8 解码错误的常见残留字符
function isMojibake(text: string): boolean {
  return /[\uFFFD\u00c0-\u00ff]{2,}/.test(text) || /锟斤拷|烫烫|Ã¥|Ã¦|Ã§/.test(text);
}

async function main() {
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNo: true,
      status: true,
      recipientName: true,
      shippingAddress: true,
      userId: true,
    },
    orderBy: { id: "asc" },
  });

  for (const order of orders) {
    const bad = isMojibake(order.recipientName) || isMojibake(order.shippingAddress);
    console.log(
      `${bad ? "❌乱码" : "✅正常"} | id=${order.id} | ${order.orderNo} | ${order.status} | 收货人: ${order.recipientName}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
