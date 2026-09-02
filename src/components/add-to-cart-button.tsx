"use client";

import { useState } from "react";

// 购物车占位按钮：购物车模块开发后的接入点
export function AddToCartButton({ disabled }: { disabled?: boolean }) {
  const [hint, setHint] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setHint("购物车功能开发中，敬请期待")}
        className="w-full rounded-full bg-orange-600 px-6 py-3 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        加入购物车
      </button>
      {hint && <p className="text-center text-xs text-orange-600">{hint}</p>}
    </div>
  );
}
