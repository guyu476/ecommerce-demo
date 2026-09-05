import { describe, expect, it } from "vitest";
import { generateOrderNo, generateTrackingNo, groupByShop, hashRequest } from "@/lib/order";

// 单号/单据生成器：格式稳定是下游（客服检索、物流对接）的隐性契约
describe("generateOrderNo", () => {
  it("格式：14 位业务时间戳 + 4 位随机 = 18 位纯数字", () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^\d{18}$/);
  });

  it("前 14 位是可读的业务时间戳（年月日时分秒）", () => {
    const orderNo = generateOrderNo();
    const stamp = orderNo.slice(0, 14);
    const year = Number(stamp.slice(0, 4));
    const month = Number(stamp.slice(4, 6));
    const day = Number(stamp.slice(6, 8));
    expect(year).toBeGreaterThanOrEqual(2026);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });

  it("随机段提供变化空间；大批量下的唯一性由数据库唯一约束最终兜底", () => {
    const batch = new Set(Array.from({ length: 200 }, () => generateOrderNo()));
    // 4 位随机段（1 万种）在 200 次采样下可能出现撞号——这正是下单事务里
    // 用 orderNo 唯一约束兜底的原因；此处只断言随机段确实在工作
    expect(batch.size).toBeGreaterThan(1);
  });
});

describe("generateTrackingNo", () => {
  it("BX 前缀 + 20 位数字（演示物流单号）", () => {
    const trackingNo = generateTrackingNo();
    expect(trackingNo).toMatch(/^BX\d{20}$/);
  });

  it("随机段确实在变化", () => {
    const batch = new Set(Array.from({ length: 50 }, () => generateTrackingNo()));
    expect(batch.size).toBeGreaterThan(1);
  });
});

// 幂等键的请求体指纹：同一幂等键重试必须携带完全相同的 JSON 序列化结果
describe("hashRequest", () => {
  it("同一对象的重复序列化得到相同指纹（重试场景）", () => {
    const body = { recipientName: "张三", userCouponId: 3 };
    expect(hashRequest(body)).toBe(hashRequest({ ...body }));
  });

  it("键序不同视为不同内容（JSON 原样哈希，键序敏感是重放契约的一部分）", () => {
    expect(hashRequest({ a: 1, b: "x" })).not.toBe(hashRequest({ b: "x", a: 1 }));
  });

  it("不同内容不同指纹", () => {
    expect(hashRequest({ a: 1 })).not.toBe(hashRequest({ a: 2 }));
  });

  it("输出为 64 位十六进制（SHA-256）", () => {
    expect(hashRequest({})).toMatch(/^[0-9a-f]{64}$/);
  });
});

// 拆单分组：跨店购物按商家拆成独立订单
describe("groupByShop", () => {
  const item = (id: number, sellerId: number | null) => ({ id, product: { sellerId } });

  it("按 sellerId 分组，组内保持原顺序", () => {
    const groups = groupByShop([item(1, 7), item(2, 9), item(3, 7)]);
    expect(groups.size).toBe(2);
    expect([...groups.get(7)!.map((i) => i.id)]).toEqual([1, 3]);
    expect([...groups.get(9)!.map((i) => i.id)]).toEqual([2]);
  });

  it("sellerId 为 null（平台自营）归入 0 号组", () => {
    const groups = groupByShop([item(1, null), item(2, 7), item(3, null)]);
    expect(groups.size).toBe(2);
    expect([...groups.get(0)!.map((i) => i.id)]).toEqual([1, 3]);
  });

  it("空购物车返回空分组", () => {
    expect(groupByShop([]).size).toBe(0);
  });
});
