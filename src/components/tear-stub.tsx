"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { formatPrice, formatSales } from "@/lib/format";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

const TEAR_THRESHOLD = 90;
const CLIP_STEPS = 8;
const DEBRIS_COLORS = ["#ffffff", "#e63946", "#fca311", "#14213d"];

// 撕票根（Verlet 物理版）：参考 dissimulate/Tearable-Cloth 的约束撕裂思路——
// 已撕开的半边是挂在撕口上的「摆」，有重力/惯性/阻尼，手指的速度会把它甩起来；
// 拉力过大时约束崩断，纸片带着当前惯性自由落体翻滚。撕声为 WebAudio 实时合成。
// 尊重 prefers-reduced-motion：不做动画，直接加购。

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---- 合成撕纸声（无音频资源：噪声 + 带通滤波 + 包络） ----
let audioCtx: AudioContext | null = null;
function ripSound(intensity: number) {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const dur = 0.08 + 0.09 * intensity;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900 + 2800 * intensity;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.1 * intensity;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  } catch {
    // 音频不可用（无设备/被策略阻止）则静默
  }
}

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
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px) rotate(${rot.toFixed(0)}deg)`, opacity: 0 },
        ],
        { duration: 420 + Math.random() * 480, easing: "cubic-bezier(.15,.6,.3,1)" },
      )
      .finished.then(() => bit.remove())
      .catch(() => bit.remove());
  }
}

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

function makeTearClips(): { leftClip: (p: number) => string; rightClip: (p: number) => string } {
  const leftJitter = Array.from({ length: CLIP_STEPS + 1 }, (_, i) =>
    i === 0 || i === CLIP_STEPS ? 0 : (i % 2 === 0 ? -1 : 1) * (0.8 + Math.random() * 1.6),
  );
  const rightJitter = leftJitter.map((v, i) => (i === 0 || i === CLIP_STEPS ? 0 : -v));
  const leftClip = (p: number) => {
    const x = p * 100;
    const teeth = leftJitter.map((j, i) => `${(x + j).toFixed(2)}% ${((i / CLIP_STEPS) * 100).toFixed(1)}%`);
    return `polygon(0% 0%, ${teeth.join(", ")}, 0% 100%)`;
  };
  const rightClip = (p: number) => {
    const x = p * 100;
    const teeth = rightJitter.map((j, i) => `${(x + j).toFixed(2)}% ${((i / CLIP_STEPS) * 100).toFixed(1)}%`);
    return `polygon(${teeth.join(", ")}, 100% 100%, 100% 0%)`;
  };
  return { leftClip, rightClip };
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
  const [view, setView] = useState({ p: 0, theta: 0, freeX: 0, freeY: 0, freeRot: 0 });
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"idle" | "torn">("idle");
  const [added, setAdded] = useState(false);
  const startX = useRef<number | null>(null);
  const lastX = useRef<number | null>(null);
  const busy = useRef(false);
  const clips = useRef(makeTearClips());
  // 物理状态：p 撕口进度；theta/omega 悬垂摆；free* 崩断后的自由落体
  const phys = useRef({ p: 0, pTarget: 0, theta: 0, omega: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 3, raf: 0, running: false, snapped: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const looseRef = useRef<HTMLDivElement>(null);
  const debrisRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);

  const progress = Math.min(1, view.p);
  const atThreshold = progress >= 1 || phys.current.snapped;

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

  function slamStamp() {
    stampRef.current?.animate(
      [
        { transform: "scale(2.4) rotate(-24deg)", opacity: 0 },
        { transform: "scale(1) rotate(-7deg)", opacity: 1 },
      ],
      { duration: 200, easing: "cubic-bezier(.2,.9,.3,1.2)" },
    );
  }

  /** Verlet 主循环：只在交互期间跑（拖拽/摆动/自由落体），静止即停 */
  function startPhysics(onSnap: () => void, onSettle: () => void) {
    const s = phys.current;
    if (s.running) return;
    s.running = true;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 1000;
      last = now;

      if (!s.snapped) {
        // 撕口追踪拖拽目标（弹簧式追赶）
        s.p += (s.pTarget - s.p) * 0.35;
        // 悬垂摆：重力回复 + 手速注入角速度 + 阻尼
        const acc = -7.5 * Math.sin(s.theta) - s.omega * 1.6;
        s.omega += acc * dt;
        s.theta += s.omega * dt;
        if (s.theta < -0.85 && s.p > 0.45) {
          // 纸弯折过头：约束崩断 → 脱离
          s.snapped = true;
          s.vx = s.omega * 260;
          s.vy = -Math.abs(s.omega) * 60;
          s.vr = s.omega * 4;
          ripSound(1);
          onSnap();
        }
      } else {
        // 自由落体 + 翻滚
        s.vy += 900 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.vr * dt;
      }

      setView({ p: s.p, theta: s.theta, freeX: s.x, freeY: s.y, freeRot: s.rot });

      const settled =
        !s.snapped && Math.abs(s.p - s.pTarget) < 0.002 && Math.abs(s.theta) < 0.002 && Math.abs(s.omega) < 0.002;
      const flown = s.snapped && s.y > 320;

      if (settled || flown) {
        s.running = false;
        onSettle();
        return;
      }
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  }

  async function handleTear() {
    if (busy.current) return;
    busy.current = true;
    setPhase("torn");
    const s = phys.current;
    s.snapped = true;
    s.vx = 120 + Math.abs(s.omega) * 200;
    s.vy = -40;
    s.vr = 3 + s.omega * 3;
    ripSound(1);

    if (!prefersReduced()) {
      if (debrisRef.current) burstDebris(debrisRef.current);
      shake(rootRef.current);
      startPhysics(() => {}, () => {});
    }

    const ok = await addToCart();
    if (ok) slamStamp();
    setAdded(true);

    window.setTimeout(() => {
      looseRef.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      setPhase("idle");
      setAdded(false);
      Object.assign(s, { p: 0, pTarget: 0, theta: 0, omega: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 3, snapped: false });
      setView({ p: 0, theta: 0, freeX: 0, freeY: 0, freeRot: 0 });
      busy.current = false;
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
    lastX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    startPhysics(
      () => {
        // 约束崩断瞬间：纸真的被撕断
        ripSound(1);
        if (debrisRef.current) burstDebris(debrisRef.current);
        shake(rootRef.current);
        void addToCart().then((ok) => {
          if (ok) slamStamp();
          setAdded(true);
        });
      },
      () => {
        // 纸片落出视野后整体复位
        setAdded(false);
        Object.assign(phys.current, { p: 0, pTarget: 0, theta: 0, omega: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 3, snapped: false });
        setView({ p: 0, theta: 0, freeX: 0, freeY: 0, freeRot: 0 });
        setPhase("idle");
      },
    );
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const raw = Math.max(0, Math.min(150, e.clientX - startX.current));
    const resist = raw > TEAR_THRESHOLD ? (raw - TEAR_THRESHOLD) * 0.3 : 0;
    const s = phys.current;
    s.pTarget = Math.min(1, (raw - resist) / TEAR_THRESHOLD);

    // 手速注入角速度（甩纸）
    const dvx = e.clientX - (lastX.current ?? e.clientX);
    lastX.current = e.clientX;
    s.omega += dvx * 0.0012;

    // 撕口每前进一截，来一声轻「嘶」
    if (s.p > 0.1 && Math.random() < 0.12) ripSound(0.35);
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    if (phys.current.p >= 0.98 && !phys.current.snapped) {
      // 拉满未崩断：约束直接失效
      phys.current.snapped = true;
      phys.current.vx = 140;
      phys.current.vy = -30;
      phys.current.vr = 4;
      ripSound(1);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void handleTear();
    }
  }

  const s = phys.current;
  const stubContent = (
    <>
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
        style={{ color: progress >= 0.7 ? "var(--color-promo)" : undefined, opacity: progress >= 0.7 ? 1 : 0.4 }}
      >
        {s.snapped ? "撕开了！" : progress >= 0.7 ? "再撕！快断了！" : "按住向右撕 = 加购"}
      </p>
    </>
  );

  const stubBase = "coupon-dash absolute inset-0 rounded-b-xl bg-paper px-4 pb-4 pt-3 dark:bg-white/5";

  return (
    <div ref={rootRef} className="relative select-none">
      {/* 底层：锯齿撕口 + 印章 */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center rounded-b-xl bg-promo/10 transition-opacity duration-150"
        style={{ opacity: phase === "torn" || progress > 0.3 || s.snapped ? 1 : 0 }}
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

      <div ref={debrisRef} aria-hidden className="pointer-events-none absolute inset-0 z-20" />

      {/* 可撕票根：左半边带物理悬垂（Verlet 摆），右半边连着卡片 */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`撕下加购，价格 ${formatPrice(price)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`relative z-10 h-[88px] cursor-grab touch-pan-y active:cursor-grabbing dark:![background-color:transparent] ${
          dragging ? "" : "transition-[clip-path,transform] duration-200"
        }`}
      >
        {/* 未撕开的右半边 */}
        <div
          aria-hidden={progress === 0}
          className={stubBase}
          style={
            progress === 0 && !dragging
              ? undefined
              : { clipPath: clips.current.rightClip(progress), transformOrigin: "100% 100%" }
          }
        >
          {stubContent}
        </div>
        {/* 已撕开的左半边：挂在撕口上，物理摆动；崩断后自由落体翻滚 */}
        <div
          ref={looseRef}
          className={stubBase}
          style={{
            opacity: progress === 0 && !dragging && !s.snapped ? 0 : 1,
            clipPath: clips.current.leftClip(progress),
            transformOrigin: "100% 50%",
            transform: s.snapped
              ? `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) rotate(${s.rot.toFixed(1)}deg)`
              : `rotate(${s.theta.toFixed(3)}rad) translateY(${(progress * 4).toFixed(1)}px)`,
          }}
        >
          {stubContent}
        </div>
      </div>
    </div>
  );
}
