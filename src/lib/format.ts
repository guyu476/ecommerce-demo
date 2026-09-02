import type { Decimal } from "@prisma/client/runtime/library";

/** 金额格式化：¥1,234.50（兼容 Prisma Decimal / number / 字符串） */
export function formatPrice(price: Decimal | number | string): string {
  const value = typeof price === "number" ? price : Number(price);
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(value);
}

/** 销量展示：1234 -> 1234，12345 -> 1.2万 */
export function formatSales(sales: number): string {
  if (sales < 10000) return `${sales}`;
  return `${(sales / 10000).toFixed(1)}万`;
}
