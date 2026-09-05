"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

// 店铺收藏按钮：进入店铺页时查一次收藏态，点击切换（未登录 toast 引导去登录）
export function ShopFavoriteButton({ shopId }: { shopId: number }) {
  const toast = useToast();
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/favorite-shops/ids");
      const result = (await res.json()) as ApiResponse<{ ids: number[] }>;
      if (isApiSuccess(result)) {
        setFavorited(result.data.ids.includes(shopId));
      }
    })();
  }, [shopId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = favorited
        ? await fetch(`/api/favorite-shops?shopId=${shopId}`, { method: "DELETE" })
        : await fetch("/api/favorite-shops", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId }),
          });
      const result = (await res.json()) as ApiResponse<{ favorited: boolean }>;
      if (result.code === 40101) {
        toast("登录后才能收藏店铺", "error");
        return;
      }
      if (!isApiSuccess(result)) {
        toast(result.message, "error");
        return;
      }
      setFavorited(result.data.favorited);
      toast(result.data.favorited ? "已收藏店铺" : "已取消收藏");
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
      aria-label={favorited ? "取消收藏店铺" : "收藏店铺"}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
        favorited
          ? "border-market bg-market/15 text-market"
          : "border-white/30 text-white/85 hover:border-market hover:text-market"
      }`}
    >
      <span className={`text-base transition-transform ${favorited ? "scale-125" : ""}`} aria-hidden>
        {favorited ? "♥" : "♡"}
      </span>
      {favorited ? "已收藏" : "收藏店铺"}
    </button>
  );
}
