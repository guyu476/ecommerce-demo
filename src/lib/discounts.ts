import { z } from "zod";
import { prisma } from "@/lib/prisma";

// 限时折扣查询：同一商品同时命中多个活动时取折扣最低的一个（对买家最优）

export interface ActiveDiscount {
  rate: number; // 折扣率 0.85 = 8.5 折
  title: string;
  endAt: Date;
  activityId: number;
}

/** 创建/编辑折扣活动入参（管理端与商家端共用） */
export const discountCreateSchema = z
  .object({
    title: z.string().trim().min(2, "活动标题至少 2 个字").max(100),
    rate: z.coerce.number().min(0.05, "折扣率最低 0.05").max(0.99, "折扣率最高 0.99"),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    productIds: z
      .array(z.coerce.number().int().positive())
      .min(1, "至少圈选一个商品")
      .max(50, "一个活动最多圈 50 个商品"),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "结束时间必须晚于开始时间",
    path: ["endAt"],
  });

/** 取一批商品的当前生效折扣（进行中；同商品取最低折扣率） */
export async function getActiveDiscounts(
  productIds: number[],
): Promise<Map<number, ActiveDiscount>> {
  const unique = [...new Set(productIds)].filter((id) => Number.isInteger(id) && id > 0);
  const map = new Map<number, ActiveDiscount>();
  if (unique.length === 0) return map;

  const now = new Date();
  const items = await prisma.discountItem.findMany({
    where: {
      productId: { in: unique },
      activity: { startAt: { lte: now }, endAt: { gt: now } },
    },
    include: { activity: true },
  });

  for (const item of items) {
    const rate = Number(item.activity.rate);
    const existing = map.get(item.productId);
    if (!existing || rate < existing.rate) {
      map.set(item.productId, {
        rate,
        title: item.activity.title,
        endAt: item.activity.endAt,
        activityId: item.activity.id,
      });
    }
  }
  return map;
}

/** 折后价（保留两位） */
export function discountedPrice(base: number, rate: number): number {
  return Math.round(base * rate * 100) / 100;
}

/** 折扣展示文案：0.85 → 「8.5 折」 */
export function rateLabel(rate: number): string {
  const zhe = rate * 10;
  const fixed = Number.isInteger(zhe) ? zhe.toFixed(0) : zhe.toFixed(1);
  return `${fixed} 折`;
}
