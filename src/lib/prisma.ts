import { PrismaClient } from "@prisma/client";

// 全局单例：开发模式热重载会反复执行模块代码，
// 挂到 globalThis 上避免重复创建数据库连接耗尽连接数。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
