"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { formatPrice, formatSales } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

const TEAR_THRESHOLD = 90;
const DEBRIS_COLORS = ["#ffffff", "#e63946", "#fca311", "#14213d"];

// 撕票根（狂野版）：按住向右拖，撕开的瞬间——票根乱飞、纸屑四溅、卡片抖动、
// 印章「啪」地盖下来。每片碎纸轨迹随机（Web Animations API），尊重减弱动效偏好。

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 碎纸乱飞：在容器里撒一把随机轨迹的纸屑 */
function burstDebris(container: HTMLElement) {
  for (let i = 0; i < 12; i++) {
    const bit = document.createElement("span");
    const w = 3 + Math.random() * 8;
    bit.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      `left:${15 + Math.random() * 65}%`,
      `top:${25 + Math.random() * 45}%`,
      `width:${w.toFixed(1)}px`,
      `height:${(w * (0.5 + Math.random())).toFixed(1)}px`,
      `background:${DEBRIS_COLORS[Math.floor(Math.random() * DEBRIS_COLORS.length)]}`,
      "border-radius:1px",
      "opacity:.95",
    ].join(";");
    container.appendChild(bit);
    const dx = (Math.random() - 0.35) * 170;
    const dy = 20 + Math.random() * 110;
    const rot = (Math.random() - 0.5) * 620;
    bit
      .animate(
        [
          { transform: `translate(0,0) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px) rotate(${rot.toFixed(0)}deg)`, opacity: 0 },
        ],
        { duration: 420 + Math.random() * 480, easing: "cubic-bezier(.15,.6,.3,1)" },
      )
      .finished.then(() => bit.remove())
      .catch(() => bit.remove());
  }
}

/** 卡片受击抖动 */
function shake(el: HTMLElement | null) {
  el?.animate(
    [
      { transform: "translateX(0) rotate(0deg)" },
      { transform: "translateX(-5px) rotate(-0.6deg)" },
      { transform: "translateX(5px) rotate(0.5deg)" },
      { transform: "translateX(-3px)" },
      { transform: "translateX(2px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 280, easing: "ease-out" },
  );
}

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
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"idle" | "torn">("idle");
  const [added, setAdded] = useState(false);
  const startX = useRef<number | null>(null);
  const deltaRef = useRef(0);
  const busy = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stubRef = useRef<HTMLDivElement>(null);
  const debrisRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);

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

  /** 印章「啪」地盖下 */
  function slamStamp() {
    stampRef.current?.animate(
      [
        { transform: "scale(2.4) rotate(-24deg)", opacity: 0 },
        { transform: "scale(1) rotate(-7deg)", opacity: 1 },
      ],
      { duration: 200, easing: "cubic-bezier(.2,.9,.3,1.2)" },
    );
  }

  async function handleTear() {
    if (busy.current) return;
    busy.current = true;
    setPhase("torn");

    // 视觉：票根乱飞 + 纸屑四溅 + 卡片抖动（减弱动效时只隐去票根）
    if (stubRef.current && !prefersReduced()) {
      stubRef.current.animate(
        [
          { transform: `translateX(${deltaRef.current}px) rotate(${deltaRef.current / 20}deg)`, opacity: 1 },
          { transform: "translate(170px,52px) rotate(34deg)", opacity: 0 },
        ],
        { duration: 430, easing: "cubic-bezier(.25,.65,.3,1)", fill: "forwards" },
      );
      if (debrisRef.current) burstDebris(debrisRef.current);
      shake(rootRef.current);
    } else if (stubRef.current) {
      stubRef.current.style.opacity = "0";
    }

    const ok = await addToCart();
    if (ok) slamStamp();
    setAdded(true);

    window.setTimeout(() => {
      stubRef.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      if (stubRef.current) stubRef.current.style.opacity = "1";
      setPhase("idle");
      setDelta(0);
      deltaRef.current = 0;
      busy.current = false;
      window.setTimeout(() => setAdded(false), 300);
    }, ok ? 1500 : 500);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (phase === "torn" || busy.current) return;
    if (prefersReduced()) {
      void handleTear();
      return;
    }
    e.stopPropagation();
    startX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    // 拖拽时的抖动/阻尼：越接近撕点越「挣扎」
    const raw = Math.max(0, Math.min(150, e.clientX - startX.current));
    const resist = raw > TEAR_THRESHOLD ? (raw - TEAR_THRESHOLD) * 0.35 : 0;
    const next = Math.max(0, raw - resist + (Math.random() - 0.5) * 2.4);
    deltaRef.current = next;
    setDelta(next);
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
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
  const dragTransform =
    phase === "torn"
      ? "translateX(0px)"
      : `translateX(${delta}px) rotate(${(delta / 16 + (dragging ? (Math.random() - 0.5) * 3 : 0)).toFixed(2)}deg)`;

  return (
    <div ref={rootRef} className="relative select-none">
      {/* 底层：锯齿撕口 + 甩出来的印章 */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center rounded-b-xl bg-promo/10 transition-opacity duration-150"
        style={{ opacity: phase === "torn" || progress > 0.3 ? 1 : 0 }}
      >
        <div aria-hidden className="tear-edge absolute inset-x-0 -top-1.5 h-2" />
        <span
          ref={stampRef}
          className={`inline-block rounded border-[3px] border-promo px-3 py-1 text-sm font-black tracking-widest text-promo ${
            added ? "-rotate-6" : "rotate-3 opacity-60"
          }`}
        >
          {added ? "已加入购物车" : "撕下加购"}
        </span>
      </div>

      {/* 碎纸粒子层 */}
      <div ref={debrisRef} aria-hidden className="pointer-events-none absolute inset-0 z-20" />

      {/* 可撕票根 */}
      <div
        ref={stubRef}
        role="button"
        tabIndex={0}
        aria-label={`撕下加购，价格 ${formatPrice(price)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`coupon-dash relative z-10 cursor-grab touch-pan-y rounded-b-xl bg-paper px-4 pb-4 pt-3 active:cursor-grabbing dark:bg-white/5 ${
          dragging ? "" : "transition-transform duration-200"
        }`}
        style={{ transform: dragTransform }}
      >
        <span aria-hidden className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-white dark:bg-[#0b1220]" />
        <span aria-hidden className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-white dark:bg-[#0b1220]" />
        <span aria-hidden className="scissors absolute -top-2.5 left-6 text-xs opacity-60 transition-opacity group-hover:opacity-100">
          ✂
        </span>

        <p className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-lg font-bold text-promo">{formatPrice(price)}</span>
          <span className="text-xs opacity-50">已售 {formatSales(sales)}</span>
        </p>
        <p
          className="mt-1 text-right text-[10px] font-medium"
          style={{ color: atThreshold ? "var(--color-promo)" : undefined, opacity: atThreshold ? 1 : 0.4 }}
        >
          {atThreshold ? "松手！！" : "按住向右撕 = 加购"}
        </p>
      </div>
    </div>
  );
}
