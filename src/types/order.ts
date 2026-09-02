// 订单模块契约（Contract First）：先定类型，实现跟随契约
// 本文件就是订单接口的文档，改动需遵守「加法优先」原则

import type { OrderStatus } from "@prisma/client";

// 下单入参：调用方提供（服务端生成订单号、状态、金额等）
export interface CreateOrderInput {
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
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
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  items: OrderItemSnapshot[];
  createdAt: string;
}

// 允许取消的状态：仅待付款（状态机守卫，接口层和页面共用）
export function canCancel(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT";
}

// 订单状态在页面上的展示文案
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "待付款",
  PAID: "已付款",
  SHIPPED: "已发货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};
