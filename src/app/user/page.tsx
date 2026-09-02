"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Me = {
  id: number;
  email: string;
  nickname: string;
  avatar: string | null;
};

const AVATAR_OPTIONS = ["🙂", "😎", "🥰", "🤠", "🐱", "🐼", "🦊", "🐸", "🌟", "🔥", "🍀", "🎉"];

// 我的淘东：个人中心（改昵称/头像 + 订单入口）
export default function UserCenterPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "guest" | "ready">("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🙂");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const result = (await res.json()) as ApiResponse<Me>;
    if (isApiSuccess(result) && result.data) {
      setMe(result.data);
      setNickname(result.data.nickname);
      setAvatar(result.data.avatar ?? "🙂");
      setStatus("ready");
    } else {
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMe();
  }, [loadMe]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, avatar }),
      });
      const result = (await res.json()) as ApiResponse<Me>;
      if (isApiSuccess(result)) {
        setMe(result.data);
        setSaved(true);
        router.refresh();
      } else {
        setError(result.message);
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center py-24 text-sm opacity-50">
        加载中…
      </main>
    );
  }

  if (status === "guest") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-sm opacity-70">登录后才能进入我的淘东</p>
        <Link
          href="/login?redirect=/user"
          className="rounded-full bg-promo px-8 py-2.5 text-sm font-medium text-white hover:bg-promo-deep"
        >
          去登录
        </Link>
      </main>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-extrabold tracking-tight">我的淘东</h1>

      {/* 个人信息卡 */}
      <section className="mb-8 rounded-2xl border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-white/5">
        <div className="mb-6 flex items-center gap-5">
          <span className="seal flex h-20 w-20 rounded-full text-5xl" style={{ rotate: "0deg" }}>
            {avatar}
          </span>
          <div>
            <p className="text-lg font-bold">{me?.nickname}</p>
            <p className="text-sm opacity-50">{me?.email}</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-5">
          <div>
            <p className="mb-2 text-sm opacity-70">选择头像</p>
            <div className="flex flex-wrap gap-2.5">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  aria-label={`选择头像 ${emoji}`}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-all ${
                    avatar === emoji
                      ? "scale-110 bg-ink text-white shadow-lg"
                      : "bg-mist hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm opacity-70" htmlFor="nickname">
              昵称
            </label>
            <input
              id="nickname"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">已保存 ✓</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-promo px-10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-promo-deep disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存修改"}
          </button>
        </form>
      </section>

      {/* 快捷入口 */}
      <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
        <h2 className="bg-mist px-6 py-3 text-sm font-semibold dark:bg-white/5">我的服务</h2>
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          <li>
            <Link
              href="/orders"
              className="flex items-center justify-between px-6 py-4 text-sm transition-colors hover:bg-mist dark:hover:bg-white/5"
            >
              <span>📦 我的订单</span>
              <span className="opacity-40">›</span>
            </Link>
          </li>
          <li>
            <Link
              href="/cart"
              className="flex items-center justify-between px-6 py-4 text-sm transition-colors hover:bg-mist dark:hover:bg-white/5"
            >
              <span>🛒 购物车</span>
              <span className="opacity-40">›</span>
            </Link>
          </li>
        </ul>
      </section>

      <button
        type="button"
        onClick={logout}
        className="mt-8 w-full rounded-full border border-black/15 py-3 text-sm opacity-70 transition-colors hover:border-promo hover:text-promo hover:opacity-100 dark:border-white/20"
      >
        退出登录
      </button>
    </main>
  );
}
