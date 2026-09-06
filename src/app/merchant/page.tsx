"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MerchantCoupons } from "@/components/merchant-coupons";
import { OrderManager } from "@/components/order-manager";
import { ProductManager } from "@/components/product-manager";
import { ShopSettings } from "@/components/shop-settings";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Me = { id: number; nickname: string; role: string } | null;

type MerchantTab = "shop" | "coupons" | "products" | "orders";

const TABS: { key: MerchantTab; label: string }[] = [
  { key: "products", label: "🛍️ 商品管理" },
  { key: "orders", label: "📦 订单发货" },
  { key: "coupons", label: "🎟️ 店铺优惠券" },
  { key: "shop", label: "🏪 店铺设置" },
];

// 商家中心：Tab 导航，每个功能独立视图（避免长页面下拉）
export default function MerchantPage() {
  const [status, setStatus] = useState<"loading" | "guest" | "denied" | "ready">("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [tab, setTab] = useState<MerchantTab>(() => {
    if (typeof window === "undefined") return "products";
    const param = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((entry) => entry.key === param) ? (param as MerchantTab) : "products";
  });

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const result = (await res.json()) as ApiResponse<Me>;
    if (isApiSuccess(result) && result.data) {
      if (result.data.role !== "MERCHANT" && result.data.role !== "ADMIN") {
        setStatus("denied");
        return;
      }
      setMe(result.data);
      setStatus("ready");

      const ordersRes = (await fetch("/api/merchant/orders").then((r) => r.json())) as ApiResponse<
        { status: string }[]
      >;
      if (isApiSuccess(ordersRes)) {
        setPendingCount(ordersRes.data.filter((order) => order.status === "PAID").length || null);
      }
    } else {
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMe();
  }, [loadMe]);

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center py-24 text-sm opacity-50">
        加载中…
      </main>
    );
  }

  if (status === "guest") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-sm opacity-70">登录后才能进入商家中心</p>
        <Link
          href="/login?redirect=/merchant"
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
        >
          去登录
        </Link>
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl">🚫</p>
        <p className="text-sm opacity-70">商家中心仅对商家/管理员账号开放</p>
        <Link href="/" className="text-sm text-promo hover:underline">
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">商家中心</h1>
        <p className="text-sm opacity-60">
          {me?.nickname}
          {pendingCount ? (
            <span className="ml-2 rounded-full bg-promo px-2 py-0.5 text-xs text-white">
              {pendingCount} 单待发货
            </span>
          ) : null}
        </p>
      </div>

      {/* 功能导航：每次只渲染当前 Tab，省去长页面下拉 */}
      <nav className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            aria-current={tab === entry.key ? "page" : undefined}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              tab === entry.key
                ? "bg-ink text-white shadow-md"
                : "bg-mist hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
            }`}
          >
            {entry.label}
            {entry.key === "orders" && pendingCount ? (
              <span className="ml-1.5 rounded-full bg-promo px-1.5 py-0.5 text-[10px] text-white">
                {pendingCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === "products" && <ProductManager />}
      {tab === "orders" &&
        (me?.role === "MERCHANT" ? (
          <OrderManager role="MERCHANT" />
        ) : (
          <p className="rounded-xl border border-dashed border-black/15 px-6 py-5 text-sm opacity-60 dark:border-white/20">
            管理员不参与发货；全平台订单请在{" "}
            <Link href="/admin" className="text-promo hover:underline">
              管理后台 → 订单管理
            </Link>{" "}
            查看（只读监督）
          </p>
        ))}
      {tab === "coupons" && <MerchantCoupons />}
      {tab === "shop" && <ShopSettings />}
    </main>
  );
}
