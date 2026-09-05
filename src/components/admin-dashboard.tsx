"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice, formatSales } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Stats = {
  userCount: number;
  merchantCount: number;
  productCount: number;
  onSaleCount: number;
  gmv: number;
  orderCount: number;
  todayOrders: number;
  pendingShipment: number;
  refundPending: number;
  statusDist: Record<string, number>;
  topSales: { id: number; name: string; sales: number; price: string }[];
  last7Days: { date: string; orders: number; amount: number }[];
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "待付款",
  PAID: "已付款",
  SHIPPED: "已发货",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

// 数据看板：经营数字 + 近 7 天趋势（纯 CSS 柱条）+ 热卖榜
export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/stats");
      const result = (await res.json()) as ApiResponse<Stats>;
      if (isApiSuccess(result)) {
        setStats(result.data);
      } else {
        setError(result.message);
      }
    })();
  }, []);

  if (error) {
    return <p className="p-5 text-sm text-red-500">{error}</p>;
  }
  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
    );
  }

  const maxDayOrders = Math.max(1, ...stats.last7Days.map((day) => day.orders));
  const cards: { label: string; value: string; hint?: string; alert?: boolean }[] = [
    { label: "累计 GMV（实付）", value: formatPrice(stats.gmv), hint: "不含取消/已退款订单" },
    { label: "订单总数", value: `${stats.orderCount}` },
    { label: "今日新订单", value: `${stats.todayOrders}` },
    { label: "待发货", value: `${stats.pendingShipment}`, alert: stats.pendingShipment > 0 },
    { label: "退款待处理", value: `${stats.refundPending}`, alert: stats.refundPending > 0 },
    { label: "用户数", value: `${stats.userCount}`, hint: `其中商家 ${stats.merchantCount} 家` },
    { label: "商品数", value: `${stats.productCount}`, hint: `在售 ${stats.onSaleCount} 件` },
  ];

  return (
    <div className="space-y-8">
      {/* 经营数字卡 */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li
            key={card.label}
            className={`rounded-2xl border p-5 ${
              card.alert ? "border-promo/40 bg-promo/5" : "border-black/10 dark:border-white/15"
            }`}
          >
            <p className="text-xs opacity-55">{card.label}</p>
            <p className={`mt-1.5 font-mono text-2xl font-black ${card.alert ? "text-promo" : ""}`}>
              {card.value}
            </p>
            {card.hint && <p className="mt-1 text-[11px] opacity-45">{card.hint}</p>}
          </li>
        ))}
      </ul>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 近 7 天趋势 */}
        <section className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
          <h3 className="mb-6 font-bold">近 7 天订单趋势</h3>
          <div className="flex h-40 items-end justify-between gap-2">
            {stats.last7Days.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="font-mono text-[10px] opacity-60">{day.orders}</span>
                <div
                  className="w-full max-w-10 rounded-t-md bg-promo/80 transition-all"
                  style={{ height: `${Math.max(4, (day.orders / maxDayOrders) * 110)}px` }}
                  title={`${day.date}：${day.orders} 单 / ${formatPrice(day.amount)}`}
                />
                <span className="text-[10px] opacity-50">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 订单状态分布 */}
        <section className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
          <h3 className="mb-6 font-bold">订单状态分布</h3>
          <ul className="space-y-3 text-sm">
            {Object.entries(STATUS_LABEL).map(([status, label]) => {
              const count = stats.statusDist[status] ?? 0;
              const pct = stats.orderCount > 0 ? Math.round((count / stats.orderCount) * 100) : 0;
              return (
                <li key={status} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 opacity-60">{label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-mist dark:bg-white/10">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-16 text-right font-mono text-xs opacity-70">{count} 单</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* 热卖榜 */}
      <section className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
        <h3 className="mb-5 font-bold">热卖 TOP 5（按销量）</h3>
        {stats.topSales.length === 0 ? (
          <p className="text-sm opacity-50">还没有销量数据</p>
        ) : (
          <ol className="space-y-3 text-sm">
            {stats.topSales.map((product, i) => (
              <li key={product.id} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                    i < 3 ? "bg-promo text-white" : "bg-mist dark:bg-white/10"
                  }`}
                >
                  {i + 1}
                </span>
                <Link
                  href={`/products/${product.id}`}
                  className="min-w-0 flex-1 truncate hover:text-promo hover:underline"
                >
                  {product.name}
                </Link>
                <span className="font-mono text-xs opacity-60">
                  {formatPrice(product.price)} · 已售 {formatSales(product.sales)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
