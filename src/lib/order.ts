import { createHash, randomInt } from "node:crypto";

// 订单号：业务时间戳 + 4 位随机（唯一性由数据库唯一约束最终兜底）
export function generateOrderNo(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${stamp}${pad(randomInt(0, 10000), 4)}`;
}

// 请求体指纹：同一幂等键重试必须携带相同内容，否则响亮报错
export function hashRequest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
