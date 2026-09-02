"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiResponse } from "@/types/api";

// 加入购物车按钮：未登录跳登录页（带回跳地址），成功后通知头部角标刷新
export function AddToCartButton({
  productId,
  disabled,
}: {
  productId: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [hint, setHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function addToCart() {
    setSubmitting(true);
    setHint(null);

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const result = (await res.json()) as ApiResponse;

      if (result.code === 40101) {
        const redirect = encodeURIComponent(window.location.pathname);
        router.push(`/login?redirect=${redirect}`);
        return;
      }
      if (result.code === 0) {
        setHint("已加入购物车 ✓");
        window.dispatchEvent(new Event("cart-changed"));
        return;
      }
      setHint(result.message);
    } catch {
      setHint("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || submitting}
        onClick={addToCart}
        className="w-full rounded-full bg-orange-600 px-6 py-3 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "加入中…" : "加入购物车"}
      </button>
      {hint && <p className="text-center text-xs text-orange-600">{hint}</p>}
    </div>
  );
}
