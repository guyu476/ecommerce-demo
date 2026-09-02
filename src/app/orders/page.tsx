"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type OrderItem = {
  id: number;
  productId: number;
  name: string;
  price: string;
  quantity: number;
};

type Order = {
  id: number;
  orderNo: string;
  status: keyof typeof STATUS_LABEL;
  totalAmount: string;
  items: OrderItem[];
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "待付款",
  PAID: "已付款",
  SHIPPED: "已发货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: "text-promo",
  PAID: "text-emerald-600 dark:text-emerald-400",
  SHIPPED: "text-blue-600 dark:text-blue-400",
  COMPLETED: "opacity-50",
  CANCELLED: "line-through opacity-40",
};

// 我的订单：列表 + 待付款可取消（取消恢复库存）
export default function OrdersPage() {
  const [status, setStatus] = useState<"loading" | "guest" | "ready">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    const result = (await res.json()) as ApiResponse<{ list: Order[] }>;
    if (result.code === 40101) {
      setStatus("guest");
      return;
    }
    if (isApiSuccess(result)) {
      setOrders(result.data.list);
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders();
  }, [loadOrders]);

  async function cancelOrder(orderId: number) {
    setBusyId(orderId);
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
    if (res.ok) await loadOrders();
    setBusyId(null);
  }

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center py-24 text-sm opacity-50">
        加载订单…
      </main>
    );
  }

  if (status === "guest") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-sm opacity-70">登录后才能查看订单</p>
        <Link
          href="/login?redirect=/orders"
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
        >
          去登录
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">我的订单</h1>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 py-16 text-center dark:border-white/20">
          <p className="mb-2 text-4xl">📦</p>
          <p className="mb-4 text-sm opacity-60">还没有订单</p>
          <Link
            href="/"
            className="inline-block rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="overflow-hidden rounded-xl border border-black/10 dark:border-white/15"
            >
              <div className="flex items-center justify-between bg-mist px-4 py-2.5 text-xs dark:bg-white/5">
                <span className="font-mono opacity-70">单号 {order.orderNo}</span>
                <span className={`font-semibold ${STATUS_STYLE[order.status] ?? ""}`}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              <ul className="divide-y divide-black/5 dark:divide-white/5">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="font-mono opacity-60">
                      {formatPrice(item.price)} × {item.quantity}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between border-t border-black/5 px-4 py-3 dark:border-white/10">
                <p className="text-sm">
                  合计：
                  <span className="ml-1 font-mono font-bold text-promo">
                    {formatPrice(order.totalAmount)}
                  </span>
                </p>
                {order.status === "PENDING_PAYMENT" && (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => cancelOrder(order.id)}
                    className="rounded-full border border-black/15 px-4 py-1.5 text-xs transition-colors hover:border-promo hover:text-promo disabled:opacity-40 dark:border-white/20"
                  >
                    {busyId === order.id ? "取消中…" : "取消订单"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
