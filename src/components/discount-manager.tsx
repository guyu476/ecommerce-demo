"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { rateLabel } from "@/lib/discounts";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type DiscountView = {
  id: number;
  title: string;
  rate: string;
  startAt: string;
  endAt: string;
  status: "pending" | "active" | "ended";
  scopeLabel?: string;
  productNames: string[];
};

type ProductOption = { id: number; name: string; price: string };

function statusBadge(status: DiscountView["status"]) {
  if (status === "active")
    return (
      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-600">
        进行中
      </span>
    );
  if (status === "pending")
    return <span className="rounded bg-market/25 px-1.5 py-0.5 text-[10px]">未开始</span>;
  return (
    <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] opacity-60 dark:bg-white/10">
      已结束
    </span>
  );
}

// 限时折扣管理（scope=admin 平台折扣 / scope=merchant 店铺折扣）
export function DiscountManager({ scope }: { scope: "admin" | "merchant" }) {
  const toast = useToast();
  const base = scope === "admin" ? "/api/admin/discounts" : "/api/merchant/discounts";
  const [activities, setActivities] = useState<DiscountView[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  // 默认时间：现在 ~ 3 天后（datetime-local 格式）
  const defaultStart = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const defaultEnd = () => {
    const d = new Date(Date.now() + 3 * 86400_000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const [form, setForm] = useState({
    title: "",
    zhe: "8.5",
    startAt: defaultStart(),
    endAt: defaultEnd(),
  });

  const load = useCallback(async () => {
    const [actRes, prodRes] = await Promise.all([fetch(base), fetch("/api/merchant/products")]);
    const actResult = (await actRes.json()) as ApiResponse<DiscountView[]>;
    const prodResult = (await prodRes.json()) as ApiResponse<ProductOption[]>;
    if (isApiSuccess(actResult)) setActivities(actResult.data);
    if (isApiSuccess(prodResult)) setProducts(prodResult.data);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          rate: Number(form.zhe) / 10, // 折 → 折扣率
          startAt: form.startAt,
          endAt: form.endAt,
          productIds: picked,
        }),
      });
      const result = (await res.json()) as ApiResponse;
      if (isApiSuccess(result)) {
        toast(result.message);
        setPicked([]);
        setForm((prev) => ({ ...prev, title: "" }));
        await load();
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
    await fetch(`${base}/${id}`, { method: "DELETE" });
    await load();
    setBusyId(null);
  }

  function toggleProduct(id: number) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 50 ? prev : [...prev, id],
    );
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-promo dark:border-white/20";

  return (
    <div className="space-y-5">
      {/* 创建表单 */}
      <form
        onSubmit={create}
        className="space-y-3 rounded-2xl border border-black/10 px-6 py-5 dark:border-white/15"
      >
        <p className="text-sm font-semibold">
          {scope === "admin" ? "发布平台折扣" : "发布店铺折扣"}
          <span className="ml-2 text-xs font-normal opacity-55">
            生效期内圈选商品按折扣率计价；同商品多活动并存时买家享最低折扣
          </span>
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="活动标题，如：开学季数码 8.5 折"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="number"
              min="0.5"
              max="9.9"
              step="0.1"
              placeholder="折扣（如 8.5 折）"
              value={form.zhe}
              onChange={(e) => setForm({ ...form, zhe: e.target.value })}
              className={inputClass}
            />
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const days = Number(e.target.value);
                const d = new Date(Date.now() + days * 86400_000);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                setForm((prev) => ({ ...prev, endAt: d.toISOString().slice(0, 16) }));
              }}
              className={inputClass}
            >
              <option value="">快捷时长…</option>
              <option value="1">1 天后结束</option>
              <option value="3">3 天后结束</option>
              <option value="7">7 天后结束</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs opacity-70">
            开始时间
            <input
              required
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              className={inputClass + " mt-1"}
            />
          </label>
          <label className="text-xs opacity-70">
            结束时间
            <input
              required
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              className={inputClass + " mt-1"}
            />
          </label>
        </div>

        {/* 圈选商品 */}
        <div>
          <p className="mb-1.5 text-xs opacity-70">
            圈选商品（{picked.length}/50）{loading && " 加载商品中…"}
          </p>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-black/10 p-2 dark:border-white/15">
            {products.map((product) => (
              <label
                key={product.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-mist dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(product.id)}
                  onChange={() => toggleProduct(product.id)}
                  className="accent-promo"
                />
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <span className="font-mono text-xs opacity-50">
                  ¥{Number(product.price).toFixed(2)}
                </span>
              </label>
            ))}
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
          {creating ? "发布中…" : "发布折扣活动"}
        </button>
      </form>

      {/* 活动列表 */}
      <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
        <div className="bg-mist px-6 py-3 text-sm font-semibold dark:bg-white/5">
          折扣活动（{activities.length} 个）
        </div>
        {loading ? (
          <p className="p-5 text-sm opacity-50">加载中…</p>
        ) : activities.length === 0 ? (
          <p className="p-5 text-sm opacity-50">还没有折扣活动</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
            {activities.map((activity) => (
              <li key={activity.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {statusBadge(activity.status)}
                      {activity.title}
                    </p>
                    <p className="mt-1 text-xs opacity-50">
                      全场 {rateLabel(Number(activity.rate))} · {activity.productNames.length}{" "}
                      个商品 ·{" "}
                      {new Date(activity.startAt).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" ~ "}
                      {new Date(activity.endAt).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-0.5 truncate text-xs opacity-40">
                      {activity.productNames.join("、")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === activity.id}
                    onClick={() => remove(activity.id)}
                    className="text-xs opacity-60 hover:text-red-500 hover:opacity-100"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
