"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type CouponTemplate = {
  id: number;
  title: string;
  threshold: string;
  discount: string;
  remaining: number;
  expired: boolean;
  claimed: boolean;
  scope: "platform" | "shop";
  scopeLabel: string;
  shopId: number | null;
};

type MyCoupon = {
  id: number;
  status: "UNUSED" | "USED";
  expired: boolean;
  title: string;
  threshold: string;
  discount: string;
  expiresAt: string;
  scope: "platform" | "shop";
  scopeLabel: string;
};

// 优惠券中心（领券 + 我的券合拼）：嵌在「我的鸟西」里，发券入口在商家中心/管理后台
export function CouponCenter() {
  const toast = useToast();
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [mine, setMine] = useState<MyCoupon[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showUsed, setShowUsed] = useState(false);

  const load = useCallback(async () => {
    const [templatesRes, meRes] = await Promise.all([fetch("/api/coupons"), fetch("/api/auth/me")]);
    const templatesResult = (await templatesRes.json()) as ApiResponse<CouponTemplate[]>;
    const meResult = (await meRes.json()) as ApiResponse<{ id: number } | null>;
    if (isApiSuccess(templatesResult)) setTemplates(templatesResult.data);
    const isLoggedIn = isApiSuccess(meResult) && meResult.data != null;
    setLoggedIn(isLoggedIn);

    if (isLoggedIn) {
      const mineRes = await fetch("/api/coupons/mine");
      const mineResult = (await mineRes.json()) as ApiResponse<MyCoupon[]>;
      if (isApiSuccess(mineResult)) setMine(mineResult.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，非同步级联，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function claim(couponId: number) {
    setBusyId(couponId);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId }),
      });
      const result = (await res.json()) as ApiResponse;
      if (result.code === 40101) {
        toast("登录后才能领券", "error");
        return;
      }
      if (!isApiSuccess(result)) {
        toast(result.message, "error");
        return;
      }
      toast("领取成功，下单时记得用～");
      await load();
    } catch {
      toast("网络异常，请稍后重试", "error");
    } finally {
      setBusyId(null);
    }
  }

  const myUnused = mine.filter((coupon) => coupon.status === "UNUSED" && !coupon.expired);
  const myUsed = mine.filter((coupon) => coupon.status === "USED" || coupon.expired);

  // 票根：左联金额（红底虚线分隔）+ 右联说明；expired/used 时做旧化处理
  function CouponTicket({
    title,
    threshold,
    discount,
    footer,
    scope,
    scopeLabel,
    muted,
    action,
  }: {
    title: string;
    threshold: string;
    discount: string;
    footer: string;
    scope?: "platform" | "shop";
    scopeLabel?: string;
    muted?: boolean;
    action?: React.ReactNode;
  }) {
    return (
      <div
        className={`flex items-stretch overflow-hidden rounded-xl border-2 border-dashed transition-all ${
          muted
            ? "border-black/10 opacity-55 dark:border-white/15"
            : "border-promo/50 bg-white shadow-md hover:-translate-y-0.5 hover:shadow-lg dark:bg-white/5"
        }`}
      >
        <span
          className={`flex min-w-24 flex-col items-center justify-center px-4 py-4 ${
            muted ? "bg-black/5 dark:bg-white/5" : "bg-promo/10"
          }`}
        >
          <span className="font-mono text-2xl font-black text-promo">
            <span className="text-xs font-medium">¥</span>
            {Number(discount)}
          </span>
          <span className="mt-0.5 text-[10px] whitespace-nowrap opacity-60">
            满 {Number(threshold)} 可用
          </span>
        </span>
        <span className="coupon-dash flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
          <span className="flex items-center gap-2">
            {scope && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  scope === "platform" ? "bg-ink text-white" : "bg-market text-ink"
                }`}
              >
                {scope === "platform" ? "平台券" : (scopeLabel ?? "店铺券")}
              </span>
            )}
            <span className="truncate text-sm font-semibold">{title}</span>
          </span>
          <span className="truncate text-xs opacity-55">{footer}</span>
          {action && <span className="mt-1">{action}</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 领券区 */}
      <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
        <div className="bg-mist px-6 py-3 text-sm font-semibold dark:bg-white/5">
          🎟️ 领券中心
          <span className="ml-2 text-xs font-normal opacity-55">
            每张限领一张，平台券全店通用、店铺券限该店商品满减
          </span>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton h-24" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/15 py-10 text-center text-sm opacity-60 dark:border-white/20">
              券都发完了，下次趁早～
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {templates.map((coupon) => (
                <li key={coupon.id}>
                  <CouponTicket
                    title={coupon.title}
                    threshold={coupon.threshold}
                    discount={coupon.discount}
                    scope={coupon.scope}
                    scopeLabel={coupon.scopeLabel}
                    footer={
                      (coupon.expired ? "已过期" : `仅剩 ${coupon.remaining} 张`) +
                      (coupon.scope === "shop" ? " · 限该店商品满减" : " · 全店通用")
                    }
                    muted={coupon.expired || (coupon.claimed && coupon.remaining === 0)}
                    action={
                      coupon.expired ? (
                        <span className="text-xs opacity-50">过期券不可领取</span>
                      ) : coupon.claimed ? (
                        <span className="text-xs text-emerald-600">✓ 已在囊中</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === coupon.id || coupon.remaining === 0}
                          onClick={() => claim(coupon.id)}
                          className="rounded-full bg-promo px-4 py-1 text-xs font-medium text-white transition-colors hover:bg-promo-deep disabled:opacity-40"
                        >
                          {busyId === coupon.id
                            ? "领取中…"
                            : coupon.remaining === 0
                              ? "已抢光"
                              : "立即领取"}
                        </button>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 我的券 */}
      {loggedIn && (
        <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-mist px-6 py-3 text-sm font-semibold dark:bg-white/5">
            <span>我的优惠券</span>
            <div className="flex gap-2 text-xs font-normal">
              <button
                type="button"
                onClick={() => setShowUsed(false)}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${
                  !showUsed
                    ? "bg-ink text-white"
                    : "bg-white/70 hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20"
                }`}
              >
                未使用（{myUnused.length}）
              </button>
              <button
                type="button"
                onClick={() => setShowUsed(true)}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${
                  showUsed
                    ? "bg-ink text-white"
                    : "bg-white/70 hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20"
                }`}
              >
                已使用 / 过期（{myUsed.length}）
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            {(showUsed ? myUsed : myUnused).length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/15 py-10 text-center text-sm opacity-60 dark:border-white/20">
                {showUsed ? "这里还没有用掉或过期的券" : "还没有可用的券，去上面挑两张吧"}
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {(showUsed ? myUsed : myUnused).map((coupon) => (
                  <li key={coupon.id}>
                    <CouponTicket
                      title={coupon.title}
                      threshold={coupon.threshold}
                      discount={coupon.discount}
                      scope={coupon.scope}
                      scopeLabel={coupon.scopeLabel}
                      muted={coupon.status === "USED" || coupon.expired}
                      footer={
                        coupon.status === "USED"
                          ? `已使用 · ${new Date(coupon.expiresAt).toLocaleDateString("zh-CN")} 前有效`
                          : coupon.expired
                            ? "已过期"
                            : `${new Date(coupon.expiresAt).toLocaleDateString("zh-CN")} 前有效`
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            {myUnused.length > 0 && (
              <p className="mt-5 text-center text-sm">
                <Link href="/cart" className="text-promo hover:underline">
                  带着优惠券去结算 →
                </Link>
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
