"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { payableAmount } from "@/types/order";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type OrderView = {
  id: number;
  orderNo: string;
  status: string;
  refundStatus: string;
  refundReason: string | null;
  refundAmount: string | null;
  trackingNo: string | null;
  totalAmount: string;
  discountAmount: string;
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

// 订单管理器：商家（含我商品的订单，可发货/处理退款）/ 管理员（全部订单，只读监督）共用
export function OrderManager({ role }: { role: "MERCHANT" | "ADMIN" }) {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // 发货：展开内联单号输入（留空自动生成演示单号）
  const [shipTarget, setShipTarget] = useState<number | null>(null);
  const [shipTracking, setShipTracking] = useState("");

  // 查询：单号 / 买家 / 收货人 / 商品名 + 状态筛选（refund = 退款待处理）
  const filtered = orders.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) {
      if (!(statusFilter === "refund" && order.refundStatus === "REQUESTED")) return false;
    }
    const text = keyword.trim().toLowerCase();
    if (!text) return true;
    return (
      order.orderNo.toLowerCase().includes(text) ||
      order.buyer.toLowerCase().includes(text) ||
      order.recipientName.toLowerCase().includes(text) ||
      order.items.some((item) => item.name.toLowerCase().includes(text))
    );
  });

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/merchant/orders");
    const result = (await res.json()) as ApiResponse<OrderView[]>;
    if (isApiSuccess(result)) setOrders(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，非同步级联，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders();
  }, [loadOrders]);

  async function transition(orderId: number, action: "ship", trackingNo?: string) {
    setBusyId(orderId);
    await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(trackingNo ? { trackingNo } : {}) }),
    });
    setShipTarget(null);
    setShipTracking("");
    await loadOrders();
    setBusyId(null);
  }

  async function handleRefund(orderId: number, approve: boolean) {
    setBusyId(orderId);
    await fetch(`/api/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: approve ? "approve" : "reject" }),
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
    <div className="space-y-4">
      {/* 查询栏：关键词 + 状态筛选 */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="🔍 搜索单号 / 买家 / 收货人 / 商品名"
          className="min-w-0 flex-1 rounded-full border border-black/15 px-4 py-2 text-sm outline-none focus:border-promo dark:border-white/20"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          <option value="all">全部状态</option>
          <option value="PENDING_PAYMENT">待付款</option>
          <option value="PAID">待发货</option>
          <option value="SHIPPED">已发货</option>
          <option value="COMPLETED">已完成</option>
          <option value="CANCELLED">已取消</option>
          <option value="refund">退款待处理</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 py-10 text-center text-sm opacity-60 dark:border-white/20">
          没有匹配的订单
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((order) => (
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

              {/* 退款申请横幅：商家处理入口 */}
              {order.refundStatus === "REQUESTED" && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-promo/10 px-4 py-2.5 text-xs">
                  <p className="text-promo">
                    💸 买家申请退款
                    {order.refundAmount != null && (
                      <span className="ml-1 font-mono font-semibold">
                        {formatPrice(payableAmount(order.totalAmount, order.discountAmount))}
                      </span>
                    )}
                    {order.refundReason && (
                      <span className="ml-2 opacity-80">原因：{order.refundReason}</span>
                    )}
                  </p>
                  {role === "MERCHANT" && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => handleRefund(order.id, true)}
                        className="rounded-full bg-promo px-4 py-1.5 font-medium text-white disabled:opacity-40"
                      >
                        同意退款（模拟打款）
                      </button>
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => handleRefund(order.id, false)}
                        className="rounded-full border border-promo/50 px-4 py-1.5 font-medium text-promo disabled:opacity-40"
                      >
                        拒绝
                      </button>
                    </span>
                  )}
                </div>
              )}
              {order.refundStatus === "REFUNDED" && (
                <div className="bg-emerald-500/10 px-4 py-2 text-xs text-emerald-600">
                  ✓ 已退款（模拟打款原路退回）
                  {order.refundReason && (
                    <span className="ml-2 opacity-70">原因：{order.refundReason}</span>
                  )}
                </div>
              )}
              {order.refundStatus === "REJECTED" && (
                <div className="px-4 py-2 text-xs opacity-60">
                  已拒绝退款申请{order.refundReason ? `（原因：${order.refundReason}）` : ""}
                </div>
              )}

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
                  {order.trackingNo && (
                    <span className="ml-2 font-mono">🚚 {order.trackingNo}</span>
                  )}
                </span>
                {/* 发货仅商家可操作（可填演示单号）；管理员只读监督 */}
                {role === "MERCHANT" &&
                  order.status === "PAID" &&
                  (shipTarget === order.id ? (
                    <span className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={shipTracking}
                        onChange={(e) => setShipTracking(e.target.value)}
                        maxLength={64}
                        placeholder="物流单号，留空自动生成"
                        className="w-52 rounded-full border border-black/15 px-3 py-1.5 outline-none focus:border-promo dark:border-white/20"
                      />
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() =>
                          transition(order.id, "ship", shipTracking.trim() || undefined)
                        }
                        className="rounded-full bg-ink px-4 py-1.5 font-medium text-white disabled:opacity-40"
                      >
                        确认发货
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShipTarget(null);
                          setShipTracking("");
                        }}
                        className="opacity-50 hover:opacity-100"
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => setShipTarget(order.id)}
                      className="rounded-full bg-ink px-5 py-1.5 font-medium text-white disabled:opacity-40"
                    >
                      {busyId === order.id ? "处理中…" : "发货"}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
