"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type ShopView = {
  id: number;
  name: string;
  logo: string | null;
  description: string | null;
  productCount: number;
} | null;

const LOGO_OPTIONS = ["🏪", "🛍️", "📦", "🧸", "💎", "🌿", "⚡", "🎨", "🍵", "🐦"];

// 店铺设置：商家中心内创建/编辑店铺；保存后商品自动归属店铺
export function ShopSettings() {
  const toast = useToast();
  const [shop, setShop] = useState<ShopView | undefined>(undefined); // undefined = 加载中
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("🏪");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShop = useCallback(async () => {
    const res = await fetch("/api/merchant/shop");
    const result = (await res.json()) as ApiResponse<{
      id: number;
      name: string;
      logo: string | null;
      description: string | null;
      productCount: number;
    } | null>;
    if (isApiSuccess(result)) {
      setShop(result.data);
      if (result.data) {
        setName(result.data.name);
        setLogo(result.data.logo ?? "🏪");
        setDescription(result.data.description ?? "");
      }
    }
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，非同步级联，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadShop();
  }, [loadShop]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logo, description }),
      });
      const result = (await res.json()) as ApiResponse<{ id: number }>;
      if (!isApiSuccess(result)) {
        setError(result.message);
        if (result.data) setError(Object.values(result.data)[0] ?? result.message);
        return;
      }
      toast(shop ? "店铺已更新" : "开店成功，生意兴隆！");
      await loadShop();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  if (shop === undefined) {
    return <p className="p-5 text-sm opacity-50">加载店铺信息…</p>;
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-promo dark:border-white/20";

  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
      <div className="flex items-center justify-between bg-mist px-6 py-3 text-sm font-semibold dark:bg-white/5">
        <span>{shop ? "店铺设置" : "开设店铺"}</span>
        {shop && (
          <Link
            href={`/shops/${shop.id}`}
            className="text-xs font-normal text-promo hover:underline"
          >
            查看店铺主页（{shop.productCount} 件在售）→
          </Link>
        )}
      </div>

      <form onSubmit={save} className="space-y-4 px-6 py-5">
        <div>
          <label className="mb-1 block text-sm opacity-70" htmlFor="shopName">
            店铺名称
          </label>
          <input
            id="shopName"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：鸟西数码旗舰店"
            className={inputClass}
          />
        </div>

        <div>
          <span className="mb-1 block text-sm opacity-70">店招 emoji</span>
          <div className="flex flex-wrap gap-2">
            {LOGO_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLogo(option)}
                aria-pressed={logo === option}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-all ${
                  logo === option
                    ? "border-promo bg-promo/10 shadow-sm"
                    : "border-black/10 hover:border-promo/50 dark:border-white/15"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm opacity-70" htmlFor="shopDesc">
            店铺简介
          </label>
          <textarea
            id="shopDesc"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="跟买家介绍一下你的店（可选）"
            className={inputClass}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink px-8 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
        >
          {saving ? "保存中…" : shop ? "保存修改" : "立即开店"}
        </button>
      </form>
    </section>
  );
}
