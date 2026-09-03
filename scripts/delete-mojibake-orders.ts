// 临时脚本：删除乱码订单（id 1、5）
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.idempotencyKey.deleteMany({ where: { orderId: { in: [1, 5] } } });
  const result = await prisma.order.deleteMany({ where: { id: { in: [1, 5] } } });
  console.log("已删除订单数:", result.count, "| 剩余订单数:", await prisma.order.count());
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
