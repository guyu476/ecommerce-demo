"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ApiResponse } from "@/types/api";

// 登录页（市集画报风 · 参考主流电商登录 UI）
// 密码登录 / 短信登录 Tab；短信登录为演示占位
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"password" | "sms">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [forgotHint, setForgotHint] = useState(false);

  const inputClass =
    "w-full rounded-xl bg-mist px-5 py-4 text-sm outline-none transition-shadow placeholder:text-black/35 focus:ring-2 focus:ring-promo/30 dark:bg-white/10 dark:placeholder:text-white/35";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agreed) {
      setError("请先阅读并同意《鸟西商城服务协议》与《隐私权政策》");
      return;
    }
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await res.json()) as ApiResponse;

      if (result.code !== 0) {
        setError(result.message);
        if (result.data) setFieldErrors(result.data as Record<string, string>);
        return;
      }

      const redirect = new URLSearchParams(window.location.search).get("redirect");
      router.push(redirect && redirect.startsWith("/") ? redirect : "/");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      {/* 登录方式 Tab */}
      <div className="mb-10 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => setTab("password")}
          className={`text-2xl font-bold tracking-wide transition-colors ${
            tab === "password"
              ? "text-promo"
              : "text-black/35 hover:text-black/60 dark:text-white/40"
          }`}
        >
          密码登录
        </button>
        <span className="h-6 w-px bg-black/15 dark:bg-white/20" aria-hidden />
        <button
          type="button"
          onClick={() => setTab("sms")}
          className={`text-2xl font-bold tracking-wide transition-colors ${
            tab === "sms" ? "text-promo" : "text-black/35 hover:text-black/60 dark:text-white/40"
          }`}
        >
          短信登录
        </button>
      </div>

      {tab === "sms" ? (
        <p className="rounded-xl bg-mist p-8 text-center text-sm leading-6 opacity-70 dark:bg-white/10">
          演示环境暂未开通短信登录
          <br />
          请切换到「密码登录」
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入邮箱"
            className={inputClass}
          />
          {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}

          <div className="relative">
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入登录密码"
              className={inputClass + " pr-24"}
            />
            <button
              type="button"
              onClick={() => setForgotHint(true)}
              className="absolute top-1/2 right-5 -translate-y-1/2 text-xs text-black/45 hover:text-promo dark:text-white/45"
            >
              忘记密码
            </button>
          </div>
          {forgotHint && (
            <p className="text-xs opacity-55">
              演示环境暂未开通找回密码，可直接使用页面底部的演示账号登录
            </p>
          )}
          {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-promo py-4 text-lg font-bold tracking-[0.3em] text-white transition-colors hover:bg-promo-deep disabled:opacity-50"
          >
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>
      )}

      <div className="mt-6 flex items-center justify-center gap-4 text-sm">
        <span className="opacity-50">遇到问题</span>
        <span className="h-3.5 w-px bg-black/15 dark:bg-white/20" aria-hidden />
        <Link href="/register" className="font-medium text-promo hover:underline">
          免费注册
        </Link>
      </div>

      {/* 协议勾选 */}
      <label className="mt-8 flex cursor-pointer items-start justify-center gap-2 text-xs leading-5 opacity-75">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 accent-promo"
        />
        <span>
          已阅读并同意
          <span className="text-promo">《鸟西商城服务协议》</span>、
          <span className="text-promo">《隐私权政策》</span>
        </span>
      </label>

      <p className="mt-5 text-center text-xs opacity-40">演示账号：demo@example.com / demo123456</p>
    </main>
  );
}
