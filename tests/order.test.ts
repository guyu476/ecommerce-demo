import { describe, expect, it } from "vitest";
import type { OrderStatus, RefundStatus } from "@prisma/client";
import {
  ORDER_TRANSITIONS,
  canCancel,
  canHandleRefund,
  canRequestRefund,
  canTransition,
  payableAmount,
  REFUND_STATUS_LABEL,
} from "@/types/order";

// 订单主状态机：契约层纯函数，接口守卫与页面按钮共用同一份规则
describe("订单主状态机 ORDER_TRANSITIONS", () => {
  it("pay 只能从 PENDING_PAYMENT 发起，流转到 PAID", () => {
    expect(ORDER_TRANSITIONS.pay).toEqual({ from: "PENDING_PAYMENT", to: "PAID" });
  });

  it("ship 只能从 PAID 发起，confirm 只能从 SHIPPED 发起", () => {
    expect(ORDER_TRANSITIONS.ship).toEqual({ from: "PAID", to: "SHIPPED" });
    expect(ORDER_TRANSITIONS.confirm).toEqual({ from: "SHIPPED", to: "COMPLETED" });
  });

  it("合法路径与非法路径", () => {
    expect(canTransition("pay", "PENDING_PAYMENT")).toBe(true);
    expect(canTransition("pay", "PAID")).toBe(false); // 不能重复支付
    expect(canTransition("ship", "PENDING_PAYMENT")).toBe(false); // 未付款不能发货
    expect(canTransition("confirm", "PAID")).toBe(false); // 未发货不能收货
  });
});

describe("取消规则 canCancel", () => {
  it("仅待付款可取消", () => {
    expect(canCancel("PENDING_PAYMENT")).toBe(true);
    const others: OrderStatus[] = ["PAID", "SHIPPED", "COMPLETED", "CANCELLED"];
    for (const status of others) {
      expect(canCancel(status)).toBe(false);
    }
  });
});

// 售后退款状态机
describe("退款规则", () => {
  it("支付后（含已完成）可申请退款，待付款/已取消不可", () => {
    expect(canRequestRefund("PAID", "NONE")).toBe(true);
    expect(canRequestRefund("SHIPPED", "NONE")).toBe(true);
    expect(canRequestRefund("COMPLETED", "NONE")).toBe(true);
    expect(canRequestRefund("PENDING_PAYMENT", "NONE")).toBe(false);
    expect(canRequestRefund("CANCELLED", "NONE")).toBe(false);
  });

  it("被拒后可重新申请，审核中/已退款不可重复申请", () => {
    expect(canRequestRefund("PAID", "REJECTED")).toBe(true);
    expect(canRequestRefund("PAID", "REQUESTED")).toBe(false);
    expect(canRequestRefund("PAID", "REFUNDED")).toBe(false);
  });

  it("商家只能处理「审核中」的申请", () => {
    expect(canHandleRefund("REQUESTED")).toBe(true);
    const others: RefundStatus[] = ["NONE", "REFUNDED", "REJECTED"];
    for (const status of others) {
      expect(canHandleRefund(status)).toBe(false);
    }
  });

  it("退款状态文案齐备", () => {
    for (const status of ["NONE", "REQUESTED", "REFUNDED", "REJECTED"] as RefundStatus[]) {
      expect(typeof REFUND_STATUS_LABEL[status]).toBe("string");
    }
  });
});

describe("金额计算 payableAmount", () => {
  it("实付 = 合计 - 优惠，接受字符串与数字（Decimal 序列化兼容）", () => {
    expect(payableAmount("3499.00", "120")).toBe(3379);
    expect(payableAmount(100, "0")).toBe(100);
    expect(payableAmount("99.9", 30)).toBe(69.9);
  });

  it("优惠大于合计时实付兜底为 0，不为负", () => {
    expect(payableAmount("10", "20")).toBe(0);
  });
});
