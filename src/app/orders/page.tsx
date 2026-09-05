"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { payableAmount } from "@/types/order";
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
  discountAmount: string;
  trackingNo: string | null;
  refundStatus: string;
  refundReason: string | null;
  coupon: { coupon: { title: string; discount: string } } | null;
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

const REFUND_LABEL: Record<string, string> = {
  REQUESTED: "退款审核中",
  REFUNDED: "已退款",
  REJECTED: "商家拒绝退款",
};

// 订单可评价条件：已发货/已完成（一单一商品一条）
function canReview(order: Order): boolean {
  return order.status === "SHIPPED" || order.status === "COMPLETED";
}

// 可申请退款：支付后（含已完成）、无进行中/已成功的退款
function canRequestRefund(order: Order): boolean {
  return (
    ["PAID", "SHIPPED", "COMPLETED"].includes(order.status) &&
    ["NONE", "REJECTED"].includes(order.refundStatus)
  );
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
  const [keyword, setKeyword] = useState("");
  const [reviewTarget, setReviewTarget] = useState<{ orderId: number; productId: number } | null>(
    null,
  );
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: "" });

  // 退款申请：展开的内联表单（原因），提交后回到列表刷新
  const [refundTarget, setRefundTarget] = useState<number | null>(null);
  const [refundReason, setRefundReason] = useState("");

  // 查询：单号 / 商品名（客户端过滤，已加载本页订单）
  const filteredOrders = orders.filter((order) => {
    const text = keyword.trim().toLowerCase();
    if (!text) return true;
    return (
      order.orderNo.toLowerCase().includes(text) ||
      order.items.some((item) => item.name.toLowerCase().includes(text))
    );
  });

  const loadOrders = useCallback(async (activeTab: Tab) => {
    const res = await fetch(`/api/orders?page=1&pageSize=50${tabQuery(activeTab)}`);
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

  async function submitRefund(orderId: number) {
    if (!refundReason.trim()) return;
    setBusyId(orderId);
    try {
      await fetch(`/api/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", reason: refundReason.trim() }),
      });
      setRefundTarget(null);
      setRefundReason("");
      await loadOrders(tab);
    } finally {
      setBusyId(null);
    }
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

      {/* 查询栏 */}
      <div className="mb-4">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="🔍 搜索单号或商品名"
          className="w-full rounded-full border border-black/15 px-5 py-2.5 text-sm outline-none focus:border-promo dark:border-white/20"
        />
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
      ) : filteredOrders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 py-12 text-center text-sm opacity-60 dark:border-white/20">
          没有匹配「{keyword}」的订单
        </p>
      ) : (
        <ul className="space-y-6">
          {filteredOrders.map((order) => {
            const pending = unreviewedItems(order);
            return (
              <li
                key={order.id}
                className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 bg-mist px-5 py-3 text-xs dark:bg-white/5">
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

                {/* 退款进度条：申请中 / 已退款 / 被拒 */}
                {order.refundStatus !== "NONE" && order.refundStatus !== null && (
                  <div
                    className={`px-5 py-2 text-xs ${
                      order.refundStatus === "REJECTED"
                        ? "bg-promo/10 text-promo"
                        : "bg-emerald-500/10 text-emerald-600"
                    }`}
                  >
                    {REFUND_LABEL[order.refundStatus] ?? order.refundStatus}
                    {order.refundReason && (
                      <span className="ml-2 opacity-70">原因：{order.refundReason}</span>
                    )}
                  </div>
                )}

                {/* 物流信息：发货后展示单号（演示单号 BX 开头） */}
                {order.trackingNo && order.status === "SHIPPED" && (
                  <div className="border-b border-black/5 px-5 py-2 text-xs dark:border-white/10">
                    🚚 物流单号：<span className="font-mono font-semibold">{order.trackingNo}</span>
                    <span className="ml-2 opacity-50">（演示物流，不提供真实轨迹）</span>
                  </div>
                )}

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

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 px-5 py-3 dark:border-white/10">
                  <div className="text-sm">
                    {Number(order.discountAmount) > 0 && (
                      <p className="text-xs opacity-60">
                        合计 {formatPrice(order.totalAmount)} - 券抵扣
                        {order.coupon ? `（${order.coupon.coupon.title}）` : ""}
                        <span className="font-mono text-promo">
                          {" "}
                          {formatPrice(order.discountAmount)}
                        </span>
                      </p>
                    )}
                    <p>
                      {Number(order.discountAmount) > 0 ? "实付：" : "合计："}
                      <span className="ml-1 font-mono font-bold text-promo">
                        {formatPrice(payableAmount(order.totalAmount, order.discountAmount))}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                    {canRequestRefund(order) && (
                      <button
                        type="button"
                        onClick={() => setRefundTarget(refundTarget === order.id ? null : order.id)}
                        className="rounded-full border border-promo/50 px-4 py-1.5 text-xs text-promo transition-colors hover:bg-promo/10 disabled:opacity-40"
                      >
                        {refundTarget === order.id ? "收起" : "申请退款"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 内联退款表单：填原因提交，商家在商家中心处理 */}
                {refundTarget === order.id && canRequestRefund(order) && (
                  <div className="space-y-2.5 border-t border-black/5 bg-promo/5 px-5 py-3 dark:border-white/10">
                    <textarea
                      rows={2}
                      maxLength={200}
                      placeholder="请填写退款原因（最多 200 字），如：不想要了 / 商品与描述不符"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={busyId === order.id || !refundReason.trim()}
                      onClick={() => submitRefund(order.id)}
                      className="rounded-full bg-promo px-6 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      提交退款申请
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
