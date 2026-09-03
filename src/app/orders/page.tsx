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
  status: string;
  totalAmount: string;
  createdAt: string;
  items: OrderItem[];
  reviews: { productId: number }[];
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "待付款",
  PAID: "已付款",
  SHIPPED: "已发货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: "text-promo font-semibold",
  PAID: "text-emerald-600 dark:text-emerald-400",
  SHIPPED: "text-blue-600 dark:text-blue-400",
  COMPLETED: "opacity-60",
  CANCELLED: "line-through opacity-40",
};

// 订单可评价条件：已发货/已完成（一单一商品一条）
function canReview(order: Order): boolean {
  return order.status === "SHIPPED" || order.status === "COMPLETED";
}

function unreviewedItems(order: Order): OrderItem[] {
  const reviewed = new Set(order.reviews.map((review) => review.productId));
  return order.items.filter((item) => !reviewed.has(item.productId));
}

type Tab = "all" | "pending" | "paid" | "shipped" | "unreviewed";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "全部订单" },
  { key: "pending", label: "待付款" },
  { key: "paid", label: "待发货" },
  { key: "shipped", label: "待收货" },
  { key: "unreviewed", label: "待评价" },
];

function tabQuery(tab: Tab): string {
  if (tab === "pending") return "&status=PENDING_PAYMENT";
  if (tab === "paid") return "&status=PAID";
  if (tab === "shipped") return "&status=SHIPPED";
  if (tab === "unreviewed") return "&filter=unreviewed";
  return "";
}

// 初始 tab 从地址栏恢复（我的鸟西入口带参跳转）；服务端渲染阶段回退到全部
function initialTab(): Tab {
  if (typeof window === "undefined") return "all";
  const search = new URLSearchParams(window.location.search);
  if (search.get("filter") === "unreviewed") return "unreviewed";
  switch (search.get("status")) {
    case "PENDING_PAYMENT":
      return "pending";
    case "PAID":
      return "paid";
    case "SHIPPED":
      return "shipped";
    default:
      return "all";
  }
}

export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>(() => initialTab());
  const [status, setStatus] = useState<"loading" | "guest" | "ready">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ orderId: number; productId: number } | null>(
    null,
  );
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: "" });

  const loadOrders = useCallback(async (activeTab: Tab) => {
    const res = await fetch(`/api/orders?page=1&pageSize=20${tabQuery(activeTab)}`);
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
    // 初始加载：setState 在 await 之后，非同步级联，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders(tab);
  }, [loadOrders, tab]);

  function switchTab(next: Tab) {
    setTab(next);
    void loadOrders(next);
  }

  async function transition(orderId: number, action: "pay" | "ship" | "confirm") {
    setBusyId(orderId);
    await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await loadOrders(tab);
    setBusyId(null);
  }

  async function cancelOrder(orderId: number) {
    setBusyId(orderId);
    await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
    await loadOrders(tab);
    setBusyId(null);
  }

  async function submitReview(orderId: number, productId: number) {
    if (!reviewForm.content.trim()) return;
    setBusyId(orderId);
    try {
      await fetch(`/api/orders/${orderId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId, rating: reviewForm.rating, content: reviewForm.content.trim() }],
        }),
      });
      setReviewTarget(null);
      setReviewForm({ rating: 5, content: "" });
      await loadOrders(tab);
    } finally {
      setBusyId(null);
    }
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

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">我的订单</h1>

      {/* 状态 Tab */}
      <div className="mb-8 flex gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
              tab === key
                ? "bg-ink text-white shadow-md"
                : "bg-mist text-ink hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 py-16 text-center text-sm dark:border-white/20">
          <p className="mb-2 text-4xl">🧾</p>
          <p className="mb-4 opacity-60">
            {tab === "pending" && "没有待付款的订单"}
            {tab === "paid" && "没有待发货的订单"}
            {tab === "shipped" && "没有待收货的订单"}
            {tab === "unreviewed" && "没有待评价的订单，买过的都评完啦"}
            {tab === "all" && "还没有订单"}
          </p>
          <Link
            href="/"
            className="inline-block rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <ul className="space-y-6">
          {orders.map((order) => {
            const pending = unreviewedItems(order);
            return (
              <li
                key={order.id}
                className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15"
              >
                <div className="flex items-center justify-between bg-mist px-5 py-3 text-xs dark:bg-white/5">
                  <span className="font-mono opacity-70">单号 {order.orderNo}</span>
                  <span className={STATUS_STYLE[order.status] ?? ""}>
                    {STATUS_LABEL[order.status] ?? order.status}
                    {canReview(order) && pending.length > 0 && (
                      <span className="ml-2 rounded bg-market px-1.5 py-0.5 text-[10px] text-ink">
                        待评价
                      </span>
                    )}
                  </span>
                </div>

                <ul className="divide-y divide-black/5 dark:divide-white/10">
                  {order.items.map((item) => {
                    const reviewed = order.reviews.some((r) => r.productId === item.productId);
                    const reviewing =
                      reviewTarget?.orderId === order.id &&
                      reviewTarget?.productId === item.productId;
                    return (
                      <li key={item.id} className="px-5 py-3">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          <span className="font-mono opacity-60">
                            {formatPrice(item.price)} × {item.quantity}
                          </span>
                          {canReview(order) &&
                            (reviewed ? (
                              <span className="text-xs text-emerald-600">已评价</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewTarget(
                                    reviewing
                                      ? null
                                      : { orderId: order.id, productId: item.productId },
                                  )
                                }
                                className="text-xs text-promo hover:underline"
                              >
                                {reviewing ? "收起" : "评价"}
                              </button>
                            ))}
                        </div>

                        {/* 内联评价表单：星级 + 文字 */}
                        {reviewing && (
                          <div className="mt-3 space-y-2.5 rounded-lg bg-mist p-3 dark:bg-white/5">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  aria-label={`${star} 星`}
                                  onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                                  className={`text-xl transition-transform hover:scale-125 ${
                                    star <= reviewForm.rating
                                      ? "text-market"
                                      : "text-black/20 dark:text-white/25"
                                  }`}
                                >
                                  ★
                                </button>
                              ))}
                              <span className="ml-1 text-xs opacity-50">
                                {reviewForm.rating} 星
                              </span>
                            </div>
                            <textarea
                              rows={2}
                              maxLength={500}
                              placeholder="说说你的使用感受吧…"
                              value={reviewForm.content}
                              onChange={(e) =>
                                setReviewForm({ ...reviewForm, content: e.target.value })
                              }
                              className={inputClass}
                            />
                            <button
                              type="button"
                              disabled={busyId === order.id || !reviewForm.content.trim()}
                              onClick={() => submitReview(order.id, item.productId)}
                              className="rounded-full bg-promo px-6 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                            >
                              发布评价
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="flex items-center justify-between border-t border-black/5 px-5 py-3 dark:border-white/10">
                  <p className="text-sm">
                    合计：
                    <span className="ml-1 font-mono font-bold text-promo">
                      {formatPrice(order.totalAmount)}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    {order.status === "PENDING_PAYMENT" && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === order.id}
                          onClick={() => cancelOrder(order.id)}
                          className="rounded-full border border-black/15 px-4 py-1.5 text-xs transition-colors hover:border-promo hover:text-promo disabled:opacity-40 dark:border-white/20"
                        >
                          取消订单
                        </button>
                        <button
                          type="button"
                          disabled={busyId === order.id}
                          onClick={() => transition(order.id, "pay")}
                          className="rounded-full bg-promo px-5 py-1.5 text-xs font-medium text-white hover:bg-promo-deep disabled:opacity-40"
                        >
                          模拟支付
                        </button>
                      </>
                    )}
                    {order.status === "PAID" && (
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => transition(order.id, "ship")}
                        className="rounded-full border border-black/15 px-4 py-1.5 text-xs transition-colors hover:border-ink disabled:opacity-40 dark:border-white/20"
                      >
                        模拟发货
                      </button>
                    )}
                    {order.status === "SHIPPED" && (
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => transition(order.id, "confirm")}
                        className="rounded-full bg-ink px-5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        确认收货
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
