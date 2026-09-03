"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type OrderView = {
  id: number;
  orderNo: string;
  status: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  buyer: string;
  createdAt: string;
  items: { productId: number; name: string; price: string; quantity: number }[];
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "待付款",
  PAID: "待发货",
  SHIPPED: "已发货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: "text-promo font-semibold",
  PAID: "text-emerald-600 dark:text-emerald-400 font-semibold",
  SHIPPED: "text-blue-600 dark:text-blue-400",
  COMPLETED: "opacity-60",
  CANCELLED: "line-through opacity-40",
};

// 订单管理器：商家（含我商品的订单，可发货）/ 管理员（全部订单，全权操作）共用
export function OrderManager({ role }: { role: "MERCHANT" | "ADMIN" }) {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/merchant/orders");
    const result = (await res.json()) as ApiResponse<OrderView[]>;
    if (isApiSuccess(result)) setOrders(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders();
  }, [loadOrders]);

  async function transition(orderId: number, action: "pay" | "ship" | "confirm") {
    setBusyId(orderId);
    await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await loadOrders();
    setBusyId(null);
  }

  if (loading) {
    return <p className="p-5 text-sm opacity-50">加载订单…</p>;
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 py-12 text-center text-sm opacity-60 dark:border-white/20">
        暂无订单
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li
          key={order.id}
          className="overflow-hidden rounded-xl border border-black/10 dark:border-white/15"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 bg-mist px-4 py-2.5 text-xs dark:bg-white/5">
            <span className="font-mono opacity-70">
              单号 {order.orderNo} · 买家 {order.buyer}
            </span>
            <span className={STATUS_STYLE[order.status] ?? ""}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>

          <ul className="divide-y divide-black/5 px-4 text-sm dark:divide-white/10">
            {order.items.map((item) => (
              <li key={item.productId} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="font-mono opacity-60">
                  {formatPrice(item.price)} × {item.quantity}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 px-4 py-3 text-xs dark:border-white/10">
            <span className="opacity-60">
              {order.recipientName} · {order.recipientPhone} · {order.shippingAddress}
            </span>
            <div className="flex gap-2">
              {order.status === "PAID" && (
                <button
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => transition(order.id, "ship")}
                  className="rounded-full bg-ink px-5 py-1.5 font-medium text-white disabled:opacity-40"
                >
                  {busyId === order.id ? "处理中…" : "发货"}
                </button>
              )}
              {role === "ADMIN" && order.status === "PENDING_PAYMENT" && (
                <button
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => transition(order.id, "pay")}
                  className="rounded-full border border-black/15 px-4 py-1.5 disabled:opacity-40 dark:border-white/20"
                >
                  标记已付款
                </button>
              )}
              {role === "ADMIN" && order.status === "SHIPPED" && (
                <button
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => transition(order.id, "confirm")}
                  className="rounded-full border border-black/15 px-4 py-1.5 disabled:opacity-40 dark:border-white/20"
                >
                  确认收货
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
