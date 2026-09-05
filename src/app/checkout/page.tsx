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
  product: {
    id: number;
    name: string;
    price: string;
    sellerId: number | null;
    category: { icon: string | null } | null;
  };
};

type CartData = { items: CartItem[]; totalQuantity: number; totalPrice: number };

type OrderCreated = { orders: { id: number; orderNo: string }[] };

// 结算可用券：UNUSED 且未过期；平台券按整单门槛，店铺券按该店商品小计门槛（一单限用一张）
type MyCoupon = {
  id: number;
  status: "UNUSED" | "USED";
  expired: boolean;
  title: string;
  threshold: string;
  discount: string;
  scope: "platform" | "shop";
  ownerUserId: number | null;
  scopeLabel: string;
};

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

  // 优惠券：可用券下拉挑选，选中的随订单提交核销
  const [usableCoupons, setUsableCoupons] = useState<MyCoupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<string>("");

  // 地址簿：登录后加载，默认地址自动填入收货信息
  type AddressOption = {
    id: number;
    recipientName: string;
    recipientPhone: string;
    shippingAddress: string;
    isDefault: boolean;
  };
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  function applyAddress(id: number) {
    const address = addresses.find((a) => a.id === id);
    if (!address) return;
    setForm({
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      shippingAddress: address.shippingAddress,
    });
  }

  const loadCart = useCallback(async () => {
    // 只拉勾选中的条目（购物车页圈选，这里只结算勾选部分）
    const res = await fetch("/api/cart?checkedOnly=1");
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

  useEffect(() => {
    if (status !== "ready") return;
    void (async () => {
      const res = await fetch("/api/addresses");
      const result = (await res.json()) as ApiResponse<AddressOption[]>;
      if (!isApiSuccess(result) || result.data.length === 0) return;
      setAddresses(result.data);
      // 表单还是空的才预填默认（或第一个）地址，不覆盖用户已输入的内容
      const preferred = result.data.find((a) => a.isDefault) ?? result.data[0];
      setSelectedAddressId(String(preferred.id));
      setForm((prev) =>
        prev.recipientName || prev.recipientPhone || prev.shippingAddress
          ? prev
          : {
              recipientName: preferred.recipientName,
              recipientPhone: preferred.recipientPhone,
              shippingAddress: preferred.shippingAddress,
            },
      );
    })();
  }, [status]);

  // 可用优惠券：未使用、未过期；平台券门槛 ≤ 整单合计，店铺券门槛 ≤ 该店商品小计（与服务端同口径预判）
  useEffect(() => {
    if (status !== "ready") return;
    void (async () => {
      const res = await fetch("/api/coupons/mine");
      const result = (await res.json()) as ApiResponse<MyCoupon[]>;
      if (!isApiSuccess(result)) return;

      // 拆单子单小计（与服务端 groupByShop 同口径：sellerId=null 平台自营记为 0 号组）
      const shopSubtotals = new Map<number, number>();
      for (const item of cart!.items) {
        const key = item.product.sellerId ?? 0;
        shopSubtotals.set(
          key,
          (shopSubtotals.get(key) ?? 0) + Number(item.product.price) * item.quantity,
        );
      }

      setUsableCoupons(
        result.data.filter((coupon) => {
          if (coupon.status !== "UNUSED" || coupon.expired) return false;
          const threshold = Number(coupon.threshold);
          if (coupon.scope === "platform") {
            // 拆单后平台券按最大单笔子单校验（与服务端同口径）
            const maxSubTotal = Math.max(0, ...shopSubtotals.values());
            return threshold <= maxSubTotal;
          }
          const shopSubtotal = shopSubtotals.get(coupon.ownerUserId ?? 0) ?? 0;
          return shopSubtotal > 0 && threshold <= shopSubtotal;
        }),
      );
    })();
  }, [status, cart]);

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
        body: JSON.stringify({
          ...form,
          ...(selectedCouponId ? { userCouponId: Number(selectedCouponId) } : {}),
        }),
      });
      const result = (await res.json()) as ApiResponse<OrderCreated>;

      if (result.code === 0 || result.code === 40905) {
        // 下单成功或幂等重放（跨店已按店铺拆成多笔子单），进入订单列表
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
        <p className="text-4xl">🛒</p>
        <p className="text-sm opacity-70">购物车里没有勾选的商品</p>
        <Link
          href="/cart"
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
        >
          回购物车勾选
        </Link>
      </main>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">确认订单</h1>

      <p className="mb-4 rounded-lg bg-market/10 px-4 py-2.5 text-xs leading-5">
        🧾 跨店商品将<strong>按店铺自动拆成多笔订单</strong>，各店铺独立发货/退款，互不影响
      </p>

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

        {addresses.length > 0 && (
          <select
            value={selectedAddressId}
            onChange={(e) => {
              setSelectedAddressId(e.target.value);
              if (e.target.value) applyAddress(Number(e.target.value));
            }}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          >
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.recipientName} · {address.recipientPhone} · {address.shippingAddress}
                {address.isDefault ? "（默认）" : ""}
              </option>
            ))}
            <option value="">手动填写新地址</option>
          </select>
        )}

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

        {/* 优惠券选择：一单一张，门槛由服务端二次校验 */}
        <div>
          <label className="mb-1 block text-sm opacity-70" htmlFor="coupon">
            优惠券
          </label>
          <select
            id="coupon"
            value={selectedCouponId}
            onChange={(e) => setSelectedCouponId(e.target.value)}
            className={inputClass}
          >
            <option value="">不使用优惠券</option>
            {usableCoupons.map((coupon) => (
              <option key={coupon.id} value={coupon.id}>
                {coupon.scope === "shop" && `[${coupon.scopeLabel}] `}
                {coupon.title}（立减 {formatPrice(Number(coupon.discount))}）
              </option>
            ))}
          </select>
          {usableCoupons.length === 0 && (
            <p className="mt-1 text-xs opacity-50">
              没有满足门槛的可用券，可去
              <Link href="/user#coupons" className="text-promo hover:underline">
                领券中心
              </Link>
              逛逛
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-mist px-4 py-3 dark:bg-white/5">
          <p className="text-sm opacity-70">共 {cart.totalQuantity} 件</p>
          <p className="text-sm opacity-70">
            商品合计：
            <span className="font-mono">{formatPrice(cart.totalPrice)}</span>
            {selectedCouponId && (
              <>
                <span className="mx-2">-</span>
                <span className="font-mono text-promo">
                  券抵{" "}
                  {formatPrice(
                    Number(
                      usableCoupons.find((c) => String(c.id) === selectedCouponId)?.discount ?? 0,
                    ),
                  )}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <p className="text-sm opacity-70">应付：</p>
          <p className="font-mono text-2xl font-bold text-promo">
            {formatPrice(
              Math.max(
                0,
                cart.totalPrice -
                  Number(
                    usableCoupons.find((c) => String(c.id) === selectedCouponId)?.discount ?? 0,
                  ),
              ),
            )}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-promo py-3 font-medium text-white transition-colors hover:bg-promo-deep disabled:opacity-50"
        >
          {submitting ? "提交中…" : "提交订单（演示环境暂不付款）"}
        </button>
      </form>
    </main>
  );
}
