"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type CartItem = {
  id: number;
  quantity: number;
  product: { id: number; name: string; price: string; category: { icon: string | null } | null };
};

type CartData = { items: CartItem[]; totalQuantity: number; totalPrice: number };

type OrderCreated = { id: number; orderNo: string };

// 结算页：提交时携带幂等键（本页生命周期内固定，失败重试复用同一 key，防止重复下单）
export default function CheckoutPage() {
  const router = useRouter();
  // 幂等键：从「结算这一意图」派生——首次提交时生成一次，失败重试复用同一 key
  const idempotencyKeyRef = useRef<string | null>(null);

  function getIdempotencyKey(): string {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  }

  const [status, setStatus] = useState<"loading" | "guest" | "empty" | "ready">("loading");
  const [cart, setCart] = useState<CartData | null>(null);
  const [form, setForm] = useState({ recipientName: "", recipientPhone: "", shippingAddress: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadCart = useCallback(async () => {
    const res = await fetch("/api/cart");
    const result = (await res.json()) as ApiResponse<CartData>;
    if (result.code === 40101) {
      setStatus("guest");
      return;
    }
    if (isApiSuccess(result)) {
      if (result.data.items.length === 0) {
        setStatus("empty");
        return;
      }
      setCart(result.data);
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCart();
  }, [loadCart]);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": getIdempotencyKey(),
        },
        body: JSON.stringify(form),
      });
      const result = (await res.json()) as ApiResponse<OrderCreated>;

      if (result.code === 0 || result.code === 40905) {
        // 下单成功或幂等重放（拿到的都是同一笔订单），进入订单列表
        router.push("/orders");
        router.refresh();
        return;
      }
      setError(result.message);
      if (result.data) setFieldErrors(result.data as Record<string, string>);
      if (result.code === 40003) setStatus("empty");
    } catch {
      // 网络失败：不换 key，用户重试安全
      setError("网络异常，请重试（不会重复下单）");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center py-24 text-sm opacity-50">
        加载结算信息…
      </main>
    );
  }

  if (status === "guest") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-sm opacity-70">登录后才能结算</p>
        <Link
          href="/login?redirect=/checkout"
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
        >
          去登录
        </Link>
      </main>
    );
  }

  if (status === "empty" || !cart) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-sm opacity-70">购物车是空的，没有可结算的商品</p>
        <Link
          href="/"
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
        >
          去逛逛
        </Link>
      </main>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">确认订单</h1>

      <ul className="mb-6 divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-mist text-2xl dark:bg-white/5">
              {item.product.category?.icon ?? "🛍️"}
            </div>
            <p className="min-w-0 flex-1 truncate text-sm">{item.product.name}</p>
            <p className="text-sm opacity-60">× {item.quantity}</p>
            <p className="w-24 text-right font-mono text-sm font-semibold">
              {formatPrice(Number(item.product.price) * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-black/10 p-5 dark:border-white/15"
      >
        <h2 className="font-semibold">收货信息</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm opacity-70" htmlFor="recipientName">
              收货人
            </label>
            <input
              id="recipientName"
              required
              value={form.recipientName}
              onChange={update("recipientName")}
              className={inputClass}
            />
            {fieldErrors.recipientName && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.recipientName}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm opacity-70" htmlFor="recipientPhone">
              手机号
            </label>
            <input
              id="recipientPhone"
              required
              inputMode="numeric"
              value={form.recipientPhone}
              onChange={update("recipientPhone")}
              placeholder="13800138000"
              className={inputClass}
            />
            {fieldErrors.recipientPhone && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.recipientPhone}</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm opacity-70" htmlFor="shippingAddress">
            收货地址
          </label>
          <textarea
            id="shippingAddress"
            required
            rows={2}
            value={form.shippingAddress}
            onChange={update("shippingAddress")}
            className={inputClass}
          />
          {fieldErrors.shippingAddress && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.shippingAddress}</p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-mist px-4 py-3 dark:bg-white/5">
          <p className="text-sm opacity-70">
            共 {cart.totalQuantity} 件，应付：
            <span className="ml-1 font-mono text-xl font-bold text-promo">
              {formatPrice(cart.totalPrice)}
            </span>
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-promo py-3 font-medium text-white transition-colors hover:bg-promo-deep disabled:opacity-50"
        >
          {submitting ? "提交中…" : "提交订单（暂不付款）"}
        </button>
      </form>
    </main>
  );
}
