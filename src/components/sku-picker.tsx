"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { parseSkuSpecs, skuSpecText } from "@/lib/sku";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

export type SpecDef = { name: string; values: string[] };
export type SkuLite = {
  id: number;
  specs: string;
  price: string;
  stock: number;
  image?: string | null;
};

// 规格选择器 + 加购：多规格商品的购买区（无规格商品仍走 AddToCartButton）
// 选中完整组合后广播 sku-image 事件，商品相册联动切到该 SKU 的配图
export function SkuPicker({
  productId,
  specDefs,
  skus,
}: {
  productId: number;
  specDefs: SpecDef[];
  skus: SkuLite[];
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  // 按已选规格匹配 SKU：所有维度都选中且完全一致
  const parsedSkus = useMemo(
    () => skus.map((sku) => ({ ...sku, parsed: parseSkuSpecs(sku.specs) })),
    [skus],
  );
  const matchedSku = useMemo(() => {
    const names = specDefs.map((def) => def.name);
    const complete = names.every((name) => selected[name]);
    if (!complete) return null;
    return (
      parsedSkus.find((sku) =>
        names.every((name) => sku.parsed.some((spec) => spec.name === name && spec.value === selected[name])),
      ) ?? null
    );
  }, [parsedSkus, selected, specDefs]);

  // 相册联动：组合配图变化时通知 ProductGallery
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("sku-image", { detail: { image: matchedSku?.image || null } }),
    );
  }, [matchedSku]);

  const minPrice = Math.min(...skus.map((sku) => Number(sku.price)));
  const totalStock = skus.reduce((sum, sku) => sum + sku.stock, 0);
  const displayPrice = matchedSku ? Number(matchedSku.price) : minPrice;
  const displayStock = matchedSku ? matchedSku.stock : totalStock;

  function select(name: string, value: string) {
    setSelected((prev) => ({ ...prev, [name]: prev[name] === value ? "" : value }));
  }

  async function addToCart() {
    const missing = specDefs.find((def) => !selected[def.name]);
    if (missing) {
      toast(`请选择「${missing.name}」`, "error");
      return;
    }
    if (!matchedSku) {
      toast("该规格组合暂时缺货", "error");
      return;
    }
    if (quantity > matchedSku.stock) {
      toast("超出该规格的库存", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, skuId: matchedSku.id, quantity }),
      });
      const result = (await res.json()) as ApiResponse;
      if (result.code === 40101) {
        toast("登录后才能加入购物车", "error");
        return;
      }
      if (!isApiSuccess(result)) {
        toast(result.message, "error");
        return;
      }
      window.dispatchEvent(new Event("cart-changed"));
      toast(result.message);
    } catch {
      toast("网络异常，请稍后重试", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 价格与库存：选中规格前显示区间（最低价）/总库存 */}
      <div>
        <p className="text-xs tracking-[0.3em] text-promo">到手价</p>
        <p className="font-mono text-4xl font-black text-promo">
          {displayPrice.toFixed(2)}
          {!matchedSku && skus.length > 1 && (
            <span className="ml-1 text-sm font-medium opacity-60">起</span>
          )}
        </p>
        <p className="mt-1 text-sm opacity-60">
          {matchedSku ? skuSpecText(matchedSku.parsed) : "请选择规格"} · 库存 {displayStock}
        </p>
      </div>

      {/* 规格选择 */}
      {specDefs.map((def) => (
        <div key={def.name}>
          <p className="mb-1.5 text-sm opacity-70">
            {def.name}
            {selected[def.name] && (
              <span className="ml-2 font-medium text-promo">{selected[def.name]}</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {def.values.map((value) => {
              const active = selected[def.name] === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => select(def.name, value)}
                  className={`rounded-lg border-2 px-4 py-1.5 text-sm transition-all ${
                    active
                      ? "border-promo bg-promo/10 font-medium text-promo"
                      : "border-black/15 hover:border-promo/60 dark:border-white/20"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 数量 + 加购 */}
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="减少数量"
            disabled={busy || quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-9 w-9 rounded-lg border border-black/15 disabled:opacity-30 dark:border-white/20"
          >
            −
          </button>
          <span className="w-10 text-center text-sm tabular-nums">{quantity}</span>
          <button
            type="button"
            aria-label="增加数量"
            disabled={busy || (matchedSku ? quantity >= matchedSku.stock : quantity >= totalStock)}
            onClick={() => setQuantity((q) => q + 1)}
            className="h-9 w-9 rounded-lg border border-black/15 disabled:opacity-30 dark:border-white/20"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={addToCart}
          disabled={busy || displayStock <= 0}
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-promo-deep disabled:opacity-40"
        >
          {displayStock <= 0 ? "暂时缺货" : "加入购物车"}
        </button>
      </div>
    </div>
  );
}
