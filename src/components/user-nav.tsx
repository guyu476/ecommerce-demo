"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Me = {
  id: number;
  email: string;
  nickname: string;
  avatar: string | null;
} | null;

// 头部用户区：「我的淘东」入口（含头像与购物车角标）
// 其他组件加购成功后 dispatch window 事件 "cart-changed" 即可触发角标刷新
export function UserNav() {
  const router = useRouter();
  const pathname = usePathname(); // 登录/登出后路由变化时重新拉取用户状态
  const [me, setMe] = useState<Me | undefined>(undefined); // undefined = 加载中
  const [cartCount, setCartCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const meRes = (await fetch("/api/auth/me").then((r) => r.json())) as ApiResponse<Me>;
      const user = isApiSuccess(meRes) ? meRes.data : null;
      setMe(user);

      if (user) {
        const cartRes = (await fetch("/api/cart").then((r) => r.json())) as ApiResponse<{
          totalQuantity: number;
        }>;
        setCartCount(isApiSuccess(cartRes) ? cartRes.data.totalQuantity : 0);
      } else {
        setCartCount(0);
      }
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    // 初始加载：setState 均发生在 await 之后，非同步级联，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    window.addEventListener("cart-changed", refresh);
    return () => window.removeEventListener("cart-changed", refresh);
  }, [refresh, pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    setCartCount(0);
    router.push("/");
    router.refresh();
  }

  if (me === undefined) {
    return <span className="text-sm opacity-40">…</span>;
  }

  return (
    <div className="flex items-center gap-6 text-sm">
      <Link href="/cart" className="hover:opacity-70">
        🛒 购物车
        {cartCount > 0 && (
          <span className="ml-1 rounded-full bg-promo px-1.5 py-0.5 text-xs text-white">
            {cartCount}
          </span>
        )}
      </Link>
      {me ? (
        <>
          <Link href="/user" className="flex items-center gap-2 hover:opacity-70">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-base">
              {me.avatar ?? "🙂"}
            </span>
            我的淘东
          </Link>
          <button type="button" onClick={logout} className="opacity-60 hover:opacity-100">
            退出
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className="hover:opacity-70">
            登录
          </Link>
          <Link href="/register" className="hover:opacity-70">
            注册
          </Link>
        </>
      )}
    </div>
  );
}
