"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type CouponView = {
  id: number;
  title: string;
  threshold: string;
  discount: string;
  totalCount: number;
  claimedCount: number;
  remaining: number;
  expired: boolean;
  expiresAt: string;
  deletable: boolean;
};

const EMPTY_FORM = { title: "", threshold: "", discount: "", totalCount: "100", validDays: "30" };

// 店铺优惠券管理：商家发券（限本店商品满减）/ 查看领取进度 / 撤下未领取的券
export function MerchantCoupons() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<CouponView[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadCoupons = useCallback(async () => {
    const res = await fetch("/api/merchant/coupons");
    const result = (await res.json()) as ApiResponse<CouponView[]>;
    if (isApiSuccess(result)) setCoupons(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，非同步级联，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCoupons();
  }, [loadCoupons]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/merchant/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await res.json()) as ApiResponse;
      if (isApiSuccess(result)) {
        toast(result.message);
        setForm(EMPTY_FORM);
        await loadCoupons();
      } else {
        setError(result.message);
        if (result.data) setFieldErrors(result.data as Record<string, string>);
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: number) {
    setBusyId(id);
    await fetch(`/api/merchant/coupons/${id}`, { method: "DELETE" });
    await loadCoupons();
    setBusyId(null);
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-promo dark:border-white/20";

  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
      <div className="bg-mist px-6 py-3 text-sm font-semibold dark:bg-white/5">
        店铺优惠券（{coupons.length} 张）
        <span className="ml-2 text-xs font-normal opacity-55">
          店铺券限本店商品满减，买家在领券中心领取
        </span>
      </div>

      {/* 发券表单 */}
      <form
        onSubmit={create}
        className="space-y-3 border-b border-black/5 px-6 py-5 dark:border-white/10"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="券标题，如：年中大促 满 200 减 30"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="门槛（满 X 元）"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              className={inputClass}
            />
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="面额（减 Y 元）"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            type="number"
            min="1"
            placeholder="发放数量"
            value={form.totalCount}
            onChange={(e) => setForm({ ...form, totalCount: e.target.value })}
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <input
              required
              type="number"
              min="1"
              max="365"
              value={form.validDays}
              onChange={(e) => setForm({ ...form, validDays: e.target.value })}
              className={inputClass}
            />
            <span className="text-sm opacity-60">天有效期</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {Object.entries(fieldErrors).map(([field, message]) => (
          <p key={field} className="text-xs text-red-500">
            {message}
          </p>
        ))}

        <button
          type="submit"
          disabled={creating}
          className="rounded-full bg-promo px-8 py-2 text-sm font-medium text-white transition-colors hover:bg-promo-deep disabled:opacity-40"
        >
          {creating ? "发布中…" : "发布店铺券"}
        </button>
      </form>

      {/* 券列表 */}
      {loading ? (
        <p className="p-5 text-sm opacity-50">加载中…</p>
      ) : coupons.length === 0 ? (
        <p className="p-5 text-sm opacity-50">还没发过券，用上方表单发第一张</p>
      ) : (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          {coupons.map((coupon) => (
            <li key={coupon.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {coupon.title}
                  {coupon.expired && (
                    <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-[10px] opacity-60 dark:bg-white/10">
                      已过期
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs opacity-50">
                  满 {Number(coupon.threshold)} 减 {Number(coupon.discount)} · 已领{" "}
                  {coupon.claimedCount}/{coupon.totalCount}
                  {coupon.expired
                    ? ""
                    : ` · ${new Date(coupon.expiresAt).toLocaleDateString("zh-CN")} 到期`}
                </p>
              </div>
              {/* 领取进度条 */}
              <div className="h-2 w-28 overflow-hidden rounded-full bg-mist dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-market"
                  style={{
                    width: `${Math.min(100, (coupon.claimedCount / coupon.totalCount) * 100)}%`,
                  }}
                />
              </div>
              {coupon.deletable && (
                <button
                  type="button"
                  disabled={busyId === coupon.id}
                  onClick={() => remove(coupon.id)}
                  className="text-xs opacity-60 hover:text-red-500 hover:opacity-100"
                >
                  撤下
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
