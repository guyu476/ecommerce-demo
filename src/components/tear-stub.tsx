"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { formatPrice, formatSales } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

const TEAR_THRESHOLD = 90;

// 可撕票根：按住价格条向右拖，撕过虚线 = 直接加购（一撕一件，可反复撕）。
// 竖直方向保留页面滚动（touch-action: pan-y）；键盘 Enter 亦可加购；尊重减弱动效偏好。
export function TearStub({
  productId,
  price,
  sales,
}: {
  productId: number;
  price: string;
  sales: number;
}) {
  const toast = useToast();
  const [delta, setDelta] = useState(0);
  const [phase, setPhase] = useState<"idle" | "torn">("idle");
  const [added, setAdded] = useState(false);
  const startX = useRef<number | null>(null);
  const deltaRef = useRef(0);
  const busy = useRef(false);

  async function addToCart(): Promise<boolean> {
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const result = (await res.json()) as ApiResponse;
      if (result.code === 40101) {
        toast("登录后才能撕下加购", "error");
        return false;
      }
      if (!isApiSuccess(result)) {
        toast(result.message, "error");
        return false;
      }
      window.dispatchEvent(new Event("cart-changed"));
      toast("已加入购物车 🎉");
      return true;
    } catch {
      toast("网络异常，请稍后重试", "error");
      return false;
    }
  }

  async function handleTear() {
    if (busy.current) return;
    busy.current = true;
    setPhase("torn");
    const ok = await addToCart();
    setAdded(ok);
    window.setTimeout(() => {
      setPhase("idle");
      setDelta(0);
      deltaRef.current = 0;
      window.setTimeout(() => setAdded(false), 300);
      busy.current = false;
    }, ok ? 1500 : 450);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (phase === "torn" || busy.current) return;
    // 减弱动效偏好：不做拖拽，直接点击撕
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void handleTear();
      return;
    }
    e.stopPropagation();
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const next = Math.max(0, Math.min(150, e.clientX - startX.current));
    deltaRef.current = next;
    setDelta(next);
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    if (deltaRef.current >= TEAR_THRESHOLD) {
      void handleTear();
    } else {
      deltaRef.current = 0;
      setDelta(0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void handleTear();
    }
  }

  const progress = Math.min(1, delta / TEAR_THRESHOLD);
  const atThreshold = delta >= TEAR_THRESHOLD;

  return (
    <div className="relative select-none">
      {/* 底层印章：撕开后露出 */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center rounded-b-xl bg-promo/10 text-sm font-semibold text-promo transition-opacity duration-150"
        style={{ opacity: phase === "torn" || progress > 0.25 ? 1 : 0 }}
      >
        {phase === "torn" ? (added ? "✓ 已加入购物车" : "已撕下") : atThreshold ? "松手！" : "再撕 →"}
      </div>

      {/* 可撕票根：虚线打孔 + 左右缺口 + 剪刀提示 */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`撕下加购，价格 ${formatPrice(price)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`coupon-dash relative z-10 cursor-grab touch-pan-y rounded-b-xl bg-paper px-4 pb-4 pt-3 active:cursor-grabbing dark:bg-white/5 ${
          phase === "idle" ? "transition-transform duration-200" : ""
        }`}
        style={{
          transform:
            phase === "torn"
              ? "translateX(130px) rotate(10deg)"
              : `translateX(${delta}px) rotate(${delta / 22}deg)`,
          opacity: phase === "torn" && added ? 0 : 1,
        }}
      >
        <span
          aria-hidden
          className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-white dark:bg-[#0b1220]"
        />
        <span
          aria-hidden
          className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-white dark:bg-[#0b1220]"
        />
        <span
          aria-hidden
          className="scissors absolute -top-2.5 left-6 text-xs opacity-60 transition-opacity group-hover:opacity-100"
        >
          ✂
        </span>

        <p className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-lg font-bold text-promo">{formatPrice(price)}</span>
          <span className="text-xs opacity-50">已售 {formatSales(sales)}</span>
        </p>
        <p
          className="mt-1 text-right text-[10px] font-medium transition-colors"
          style={{ color: atThreshold ? "var(--color-promo)" : undefined, opacity: atThreshold ? 1 : 0.4 }}
        >
          {atThreshold ? "松手撕下 →" : "按住向右撕 = 加购"}
        </p>
      </div>
    </div>
  );
}
