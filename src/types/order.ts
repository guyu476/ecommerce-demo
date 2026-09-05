// 订单模块契约（Contract First）：先定类型，实现跟随契约
// 本文件就是订单接口的文档，改动需遵守「加法优先」原则

import type { OrderStatus, RefundStatus } from "@prisma/client";

// 下单入参：调用方提供（服务端生成订单号、状态、金额等）
// 跨店拆单：一次结算按商家拆成多笔独立订单（同 checkoutGroupId），各自发货/退款/取消；
// 优惠券落在其作用域子单上（平台券→金额最大子单，店铺券→该店子单）
export interface CreateOrderInput {
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  /** 可选：使用的用户优惠券 id（UNUSED 且未过期、满足门槛） */
  userCouponId?: number;
}

// 订单快照条目：商品名与单价为下单时刻的快照
export interface OrderItemSnapshot {
  id: number;
  productId: number;
  name: string;
  price: string; // Decimal 序列化为字符串，避免精度丢失
  quantity: number;
}

// 订单（系统返回）
export interface OrderDTO {
  id: number;
  orderNo: string;
  status: OrderStatus;
  totalAmount: string;
  /** 优惠券抵扣金额（未用券为 "0"）；实付 = totalAmount - discountAmount */
  discountAmount: string;
  /** 发货物流单号（商家填写，留空由服务端生成演示单号） */
  trackingNo: string | null;
  refundStatus: RefundStatus;
  refundReason: string | null;
  /** 使用的优惠券（已用券才有） */
  coupon: { title: string; discount: string } | null;
  items: OrderItemSnapshot[];
  createdAt: string;
}

// ============ 主状态机 ============
// PENDING_PAYMENT --pay--> PAID --ship--> SHIPPED --confirm--> COMPLETED
// 取消：仅待付款（恢复库存）。退款审批通过同样转入 CANCELLED（见下方退款规则）
export const ORDER_TRANSITIONS = {
  pay: { from: "PENDING_PAYMENT", to: "PAID" },
  ship: { from: "PAID", to: "SHIPPED" },
  confirm: { from: "SHIPPED", to: "COMPLETED" },
} as const satisfies Record<string, { from: OrderStatus; to: OrderStatus }>;

export type TransitionAction = keyof typeof ORDER_TRANSITIONS; // "pay" | "ship" | "confirm"

export function canTransition(action: TransitionAction, from: OrderStatus): boolean {
  return ORDER_TRANSITIONS[action].from === from;
}

// 允许取消的状态：仅待付款（状态机守卫，接口层和页面共用）
export function canCancel(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT";
}

// ============ 售后退款状态机 ============
// NONE/REJECTED --request--> REQUESTED --approve--> REFUNDED（订单转 CANCELLED，回补库存）
//                                      --reject---> REJECTED（可重新申请）
// 支付后（含已完成）都可申请；演示环境同意后直接模拟打款到账
const REFUND_REQUESTABLE_STATUSES: readonly OrderStatus[] = ["PAID", "SHIPPED", "COMPLETED"];

export function canRequestRefund(status: OrderStatus, refundStatus: RefundStatus): boolean {
  return (
    REFUND_REQUESTABLE_STATUSES.includes(status) &&
    (refundStatus === "NONE" || refundStatus === "REJECTED")
  );
}

export function canHandleRefund(refundStatus: RefundStatus): boolean {
  return refundStatus === "REQUESTED";
}

// 订单状态在页面上的展示文案
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "待付款",
  PAID: "已付款",
  SHIPPED: "已发货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

// 退款状态在页面上的展示文案
export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  NONE: "",
  REQUESTED: "退款审核中",
  REFUNDED: "已退款",
  REJECTED: "商家拒绝退款",
};

// 实付金额 = 商品合计 - 优惠抵扣（纯函数，接口层与页面共用，避免各处重复实现）
export function payableAmount(totalAmount: string | number, discountAmount: string | number) {
  return Math.max(0, Number(totalAmount) - Number(discountAmount));
}
