// 临时清理脚本：删除 4 个测试残留账号
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const targets = [
  { email: "test@example.com" },
  { phone: "13812345678" },
  { phone: "13755556666" },
  { phone: "13998765432" },
];

async function main() {
  for (const where of targets) {
    const user = await prisma.user.findFirst({ where });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
      console.log("已删除:", user.id, user.email || user.phone);
    } else {
      console.log("未找到:", JSON.stringify(where));
    }
  }
  console.log("剩余用户数:", await prisma.user.count());
}

main()
  .catch((error) => {
    console.error("清理失败:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
