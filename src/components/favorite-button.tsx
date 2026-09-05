"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

// 商品收藏心形：进入页面时查一次收藏态，点击切换（未登录 toast 引导去登录）
export function FavoriteButton({ productId }: { productId: number }) {
  const toast = useToast();
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/favorites/ids");
      const result = (await res.json()) as ApiResponse<{ ids: number[] }>;
      if (isApiSuccess(result)) {
        setFavorited(result.data.ids.includes(productId));
      }
    })();
  }, [productId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = favorited
        ? await fetch(`/api/favorites?productId=${productId}`, { method: "DELETE" })
        : await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          });
      const result = (await res.json()) as ApiResponse<{ favorited: boolean }>;
      if (result.code === 40101) {
        toast("登录后才能收藏商品", "error");
        return;
      }
      if (!isApiSuccess(result)) {
        toast(result.message, "error");
        return;
      }
      setFavorited(result.data.favorited);
      toast(result.data.favorited ? "已加入收藏" : "已取消收藏");
    } catch {
      toast("网络异常，请稍后重试", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorited}
      aria-label={favorited ? "取消收藏" : "加入收藏"}
      className={`flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
        favorited
          ? "border-promo bg-promo/10 text-promo"
          : "border-black/15 hover:border-promo hover:text-promo dark:border-white/20"
      }`}
    >
      <span
        className={`text-base transition-transform ${favorited ? "scale-125 text-promo" : ""}`}
        aria-hidden
      >
        {favorited ? "♥" : "♡"}
      </span>
      {favorited ? "已收藏" : "收藏"}
    </button>
  );
}
