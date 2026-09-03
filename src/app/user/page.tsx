"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AddressManager } from "@/components/address-manager";
import type { ApiResponse } from "@/types/api";
import { isApiSuccess } from "@/types/api";

type Me = {
  id: number;
  email: string;
  nickname: string;
  avatar: string | null;
};

const AVATAR_OPTIONS = ["🙂", "😎", "🥰", "🤠", "🐱", "🐼", "🦊", "🐸", "🌟", "🔥", "🍀", "🎉"];

// 头像统一渲染：data URL 用 <img>，emoji 用文字
function AvatarView({ avatar, sizeClass }: { avatar: string | null; sizeClass: string }) {
  if (avatar?.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt="头像" className={`${sizeClass} rounded-full object-cover`} />;
  }
  return <span className={`${sizeClass} flex items-center justify-center`}>{avatar ?? "🙂"}</span>;
}

// 我的鸟西：个人中心（改昵称/头像上传 + 地址簿 + 订单入口）
export default function UserCenterPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "guest" | "ready">("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🙂");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderCounts, setOrderCounts] = useState<{
    all: number;
    pending: number;
    paid: number;
    shipped: number;
    unreviewed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const result = (await res.json()) as ApiResponse<Me>;
    if (isApiSuccess(result) && result.data) {
      setMe(result.data);
      setNickname(result.data.nickname);
      setAvatar(result.data.avatar ?? "🙂");
      setStatus("ready");

      // 各状态订单数量（入口红点）
      const countsRes = (await fetch("/api/orders/counts").then((r) => r.json())) as ApiResponse<{
        all: number;
        pending: number;
        paid: number;
        shipped: number;
        unreviewed: number;
      }>;
      if (isApiSuccess(countsRes)) setOrderCounts(countsRes.data);
    } else {
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    // 初始加载：setState 在 await 之后，规则误报
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMe();
  }, [loadMe]);

  // 头像上传：客户端等比裁剪压缩到 192×192 JPEG（data URL），不占服务器存储
  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("图片不能超过 5MB");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 192;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        setAvatar(canvas.toDataURL("image/jpeg", 0.85));
        setSaved(false);
      };
      img.onerror = () => setError("图片读取失败");
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

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
        <p className="text-sm opacity-70">登录后才能进入我的鸟西</p>
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
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-6 py-12">
      <h1 className="text-2xl font-extrabold tracking-tight">我的鸟西</h1>

      {/* 个人信息卡 */}
      <section className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-white/5">
        <div className="mb-6 flex items-center gap-5">
          <span
            className="seal flex h-20 w-20 overflow-hidden rounded-full text-5xl"
            style={{ rotate: "0deg" }}
          >
            <AvatarView avatar={avatar} sizeClass="h-full w-full" />
          </span>
          <div>
            <p className="text-lg font-bold">{me?.nickname}</p>
            <p className="text-sm opacity-50">{me?.email}</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-5">
          <div>
            <p className="mb-2 text-sm opacity-70">选择表情头像</p>
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
            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-dashed border-black/25 px-4 py-1.5 text-xs opacity-70 transition-colors hover:border-promo hover:text-promo hover:opacity-100 dark:border-white/25"
              >
                ⬆ 上传自定义头像（自动裁剪为圆形）
              </button>
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

      {/* 地址簿 */}
      <AddressManager />

      {/* 我的订单：全部入口 + 未处理数量红点 */}
      <section className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
        <h2 className="bg-mist px-6 py-3 text-sm font-semibold dark:bg-white/5">我的订单</h2>
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {[
            { label: "🧾 全部订单", href: "/orders", count: orderCounts?.all ?? 0 },
            {
              label: "⏳ 待付款",
              href: "/orders?status=PENDING_PAYMENT",
              count: orderCounts?.pending ?? 0,
            },
            { label: "📦 待发货", href: "/orders?status=PAID", count: orderCounts?.paid ?? 0 },
            {
              label: "🚚 待收货",
              href: "/orders?status=SHIPPED",
              count: orderCounts?.shipped ?? 0,
            },
            {
              label: "✍️ 待评价",
              href: "/orders?filter=unreviewed",
              count: orderCounts?.unreviewed ?? 0,
            },
          ].map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className="flex items-center justify-between px-6 py-4 text-sm transition-colors hover:bg-mist dark:hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  {entry.label}
                  {entry.count > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-promo px-1.5 text-[10px] font-bold text-white">
                      {entry.count > 99 ? "99+" : entry.count}
                    </span>
                  )}
                </span>
                <span className="opacity-40">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={logout}
        className="w-full rounded-full border border-black/15 py-3 text-sm opacity-70 transition-colors hover:border-promo hover:text-promo hover:opacity-100 dark:border-white/20"
      >
        退出登录
      </button>
    </main>
  );
}
