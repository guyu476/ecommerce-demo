"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { formatPrice } from "@/lib/format";
import { parseProductImagesPure } from "@/lib/product-images";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type CartItem = {
  id: number;
  quantity: number;
  checked: boolean;
  skuSpecs?: string | null;
  // SKU 现价（服务端按 skuId 取，无规格=商品价）
  unitPrice?: string;
  product: {
    id: number;
    name: string;
    price: string;
    stock: number;
    images: string | null;
    category: { id: number; name: string; icon: string | null } | null;
  };
};

type CartData = {
  items: CartItem[];
  totalQuantity: number;
  totalPrice: number;
};

// 勾选圈：圆圈按钮，选中填充主题色打勾
function CheckCircle({ checked, onToggle, disabled }: { checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? "取消勾选" : "勾选结算"}
      disabled={disabled}
      onClick={onToggle}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all disabled:opacity-40 ${
        checked
          ? "border-promo bg-promo text-white"
          : "border-black/25 hover:border-promo dark:border-white/30"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path d="M3 8.5 L6.5 12 L13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// 购物车页：勾选结算（单选圈 + 左下角全选）/ 数量增减 / 移除 / 合计只算勾选项
export default function CartPage() {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<"loading" | "guest" | "ready">("loading");
  const [cart, setCart] = useState<CartData | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [allToggling, setAllToggling] = useState(false);

  const loadCart = useCallback(async () => {
    const res = await fetch("/api/cart");
    const result = (await res.json()) as ApiResponse<CartData>;
    if (result.code === 40101) {
      setStatus("guest");
      return;
    }
    if (isApiSuccess(result)) {
      setCart(result.data);
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    // 初始加载：setState 均发生在 await 之后，非同步级联，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCart();
  }, [loadCart]);

  function notifyCartChanged() {
    window.dispatchEvent(new Event("cart-changed"));
  }

  async function updateQuantity(itemId: number, quantity: number) {
    if (quantity < 1 || quantity > 99) return;
    setBusyId(itemId);
    await fetch(`/api/cart/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    await loadCart();
    notifyCartChanged();
    setBusyId(null);
  }

  async function toggleChecked(itemId: number, checked: boolean) {
    setBusyId(itemId);
    await fetch(`/api/cart/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
    await loadCart();
    setBusyId(null);
  }

  async function toggleAll() {
    if (!cart) return;
    const everythingChecked = cart.items.every((item) => item.checked);
    setAllToggling(true);
    await fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !everythingChecked }),
    });
    await loadCart();
    setAllToggling(false);
  }

  async function removeItem(itemId: number) {
    setBusyId(itemId);
    await fetch(`/api/cart/${itemId}`, { method: "DELETE" });
    await loadCart();
    notifyCartChanged();
    setBusyId(null);
  }

  // 批量删除勾选中的商品（配合全选即可整批清掉）
  const [deletingChecked, setDeletingChecked] = useState(false);
  async function removeChecked() {
    if (checkedItems.length === 0) return;
    setDeletingChecked(true);
    try {
      const res = await fetch("/api/cart?checked=1", { method: "DELETE" });
      const result = (await res.json()) as ApiResponse<{ deleted: number }>;
      if (isApiSuccess(result)) {
        toast(result.message);
        await loadCart();
        notifyCartChanged();
      } else {
        toast(result.message, "error");
      }
    } catch {
      toast("网络异常，请稍后重试", "error");
    } finally {
      setDeletingChecked(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center py-24 text-sm opacity-50">
        加载购物车…
      </main>
    );
  }

  if (status === "guest") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-sm opacity-70">登录后才能查看购物车</p>
        <Link
          href="/login?redirect=/cart"
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
        >
          去登录
        </Link>
      </main>
    );
  }

  const items = cart?.items ?? [];
  const isEmpty = items.length === 0;
  // 合计只算勾选中的条目（与服务端下单口径一致）
  const checkedItems = items.filter((item) => item.checked);
  const checkedQuantity = checkedItems.reduce((sum, item) => sum + item.quantity, 0);
  const checkedTotal = checkedItems.reduce(
    (sum, item) => sum + Number(item.unitPrice ?? item.product.price) * item.quantity,
    0,
  );
  const everythingChecked = !isEmpty && checkedItems.length === items.length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">
        购物车
        {cart && cart.totalQuantity > 0 && (
          <span className="ml-2 text-sm font-normal opacity-50">共 {cart.totalQuantity} 件</span>
        )}
      </h1>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-black/15 py-16 text-center dark:border-white/20">
          <p className="mb-2 text-4xl">🛒</p>
          <p className="mb-4 text-sm opacity-60">购物车还是空的</p>
          <Link
            href="/"
            className="inline-block rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 p-4">
                <CheckCircle
                  checked={item.checked}
                  disabled={busyId === item.id}
                  onToggle={() => toggleChecked(item.id, !item.checked)}
                />
                {/* 商品实拍图：无图时回退分类 emoji */}
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-mist text-3xl ${item.checked ? "" : "opacity-40"}`}>
                  {parseProductImagesPure(item.product.images)[0] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={parseProductImagesPure(item.product.images)[0]}
                      alt={item.product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    item.product.category?.icon ?? "🛍️"
                  )}
                </div>

                <div className={`min-w-0 flex-1 ${item.checked ? "" : "opacity-50"}`}>
                  <Link
                    href={`/products/${item.product.id}`}
                    className="line-clamp-1 text-sm hover:underline"
                  >
                    {item.product.name}
                  </Link>
                  {item.skuSpecs && (
                    <p className="mt-0.5 text-xs opacity-50">{item.skuSpecs}</p>
                  )}
                  <p className="mt-1 text-sm font-bold text-red-600 dark:text-red-400">
                    {formatPrice(item.unitPrice ?? item.product.price)}
                  </p>
                </div>

                <div className={`flex items-center gap-2 ${item.checked ? "" : "opacity-40"}`}>
                  <button
                    type="button"
                    aria-label="减少数量"
                    disabled={busyId === item.id || item.quantity <= 1}
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="h-7 w-7 rounded border border-black/15 disabled:opacity-30 dark:border-white/20"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="增加数量"
                    disabled={busyId === item.id || item.quantity >= item.product.stock}
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="h-7 w-7 rounded border border-black/15 disabled:opacity-30 dark:border-white/20"
                  >
                    +
                  </button>
                </div>

                <p className={`w-24 text-right text-sm font-semibold tabular-nums ${item.checked ? "" : "opacity-40"}`}>
                  {formatPrice(Number(item.unitPrice ?? item.product.price) * item.quantity)}
                </p>

                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => removeItem(item.id)}
                  className="text-xs opacity-50 hover:text-promo hover:opacity-100"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>

          {/* 结算栏：左下角全选，合计只算勾选项 */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/5 px-6 py-4 dark:bg-white/10">
            <div className="flex items-center gap-5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <CheckCircle
                  checked={everythingChecked}
                  disabled={allToggling}
                  onToggle={toggleAll}
                />
                全选
              </label>
              <button
                type="button"
                disabled={deletingChecked || checkedItems.length === 0}
                onClick={removeChecked}
                className="text-sm opacity-60 transition-colors hover:text-promo hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
                title={checkedItems.length === 0 ? "先勾选要删除的商品" : undefined}
              >
                {deletingChecked ? "删除中…" : `删除选中（${checkedItems.length}）`}
              </button>
              <p className="text-sm opacity-70">
                已选 {checkedQuantity} 件，合计：
                <span className="ml-1 text-xl font-bold text-red-600 dark:text-red-400">
                  {formatPrice(checkedTotal)}
                </span>
              </p>
            </div>
            <button
              type="button"
              disabled={checkedItems.length === 0}
              onClick={() => router.push("/checkout")}
              className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep disabled:cursor-not-allowed disabled:opacity-40"
              title={checkedItems.length === 0 ? "请先勾选要结算的商品" : undefined}
            >
              {checkedItems.length === 0 ? "请勾选商品" : `去结算（${checkedItems.length} 种）`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
