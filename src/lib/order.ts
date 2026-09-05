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

// 演示物流单号：BX（鸟西快递）+ 时间戳 + 6 位随机。真实接入时替换为快递公司下单/电子面单接口
export function generateTrackingNo(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `BX${stamp}${pad(randomInt(0, 1000000), 6)}`;
}

// ============ 拆单分组 ============

export interface ShopGroupableItem {
  product: { sellerId: number | null };
}

/**
 * 按商家拆单分组：跨店购物一次结算时，一店一笔订单，各自独立发货/退款/取消。
 * sellerId 为 null（平台自营）归入 0 号组。保持原有条目顺序，组按首次出现顺序排列。
 */
export function groupByShop<T extends ShopGroupableItem>(items: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const key = item.product.sellerId ?? 0;
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}
