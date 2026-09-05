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

// 商家中心：商品管理 + 订单发货（商家/管理员可用）
export default function MerchantPage() {
  const [status, setStatus] = useState<"loading" | "guest" | "denied" | "ready">("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

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
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-12">
      <div className="flex items-end justify-between">
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

      <ShopSettings />
      <MerchantCoupons />
      <ProductManager />
      <section className="space-y-4">
        <h2 className="text-lg font-extrabold tracking-tight">订单发货</h2>
        <OrderManager role={me?.role === "ADMIN" ? "ADMIN" : "MERCHANT"} />
      </section>
    </main>
  );
}
