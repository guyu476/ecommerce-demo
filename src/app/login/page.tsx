"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import type { ApiResponse } from "@/types/api";

// 登录页（市集画报风 · 参考主流电商登录 UI）
// 密码登录（邮箱/手机号）+ 短信登录（演示环境模拟验证码，未注册自动创建账号）
// + 找回密码（演示环境模拟短信验证码，任意 6 位数字通过）
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"password" | "sms" | "reset">("password");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // 短信登录状态（演示环境：点击获取验证码后模拟显示，服务端不做真实校验）
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // 找回密码状态（与短信登录同一套模拟口径）
  const [resetPhone, setResetPhone] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetMockCode, setResetMockCode] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const inputClass =
    "w-full rounded-xl bg-mist px-5 py-4 text-sm outline-none transition-shadow placeholder:text-black/35 focus:ring-2 focus:ring-promo/30 dark:bg-white/10 dark:placeholder:text-white/35";

  function sendCode() {
    if (!/^1[3-9]\d{9}$/.test(smsPhone)) {
      setError("请先输入正确的手机号");
      return;
    }
    setError(null);
    setMockCode(String(Math.floor(100000 + Math.random() * 900000)));
    setCountdown(60);
  }

  function sendResetCode() {
    if (!/^1[3-9]\d{9}$/.test(resetPhone)) {
      setError("请先输入正确的手机号");
      return;
    }
    setError(null);
    setResetMockCode(String(Math.floor(100000 + Math.random() * 900000)));
    setCountdown(60);
  }

  function switchTab(next: "password" | "sms" | "reset") {
    setTab(next);
    setError(null);
    setFieldErrors({});
  }

  function navigateAfterAuth() {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    router.push(redirect && redirect.startsWith("/") ? redirect : "/");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // 找回密码：不参与协议勾选校验，成功后回密码登录
    if (tab === "reset") {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: resetPhone, code: resetCode, newPassword: resetPassword }),
        });
        const result = (await res.json()) as ApiResponse;
        if (result.code !== 0) {
          setError(result.message);
          return;
        }
        setTab("password");
        setNotice("密码已重置，请用新密码登录");
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!agreed) {
      setError("请先阅读并同意《鸟西商城服务协议》与《隐私权政策》");
      return;
    }
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      if (tab === "password") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account, password }),
        });
        const result = (await res.json()) as ApiResponse;
        if (result.code !== 0) {
          setError(result.message);
          if (result.data) setFieldErrors(result.data as Record<string, string>);
          return;
        }
      } else {
        const res = await fetch("/api/auth/sms-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: smsPhone, code: smsCode }),
        });
        const result = (await res.json()) as ApiResponse;
        if (result.code !== 0) {
          setError(result.message);
          return;
        }
      }
      navigateAfterAuth();
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
          onClick={() => switchTab("password")}
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
          onClick={() => switchTab("sms")}
          className={`text-2xl font-bold tracking-wide transition-colors ${
            tab === "sms" ? "text-promo" : "text-black/35 hover:text-black/60 dark:text-white/40"
          }`}
        >
          短信登录
        </button>
        {tab === "reset" && (
          <>
            <span className="h-6 w-px bg-black/15 dark:bg-white/20" aria-hidden />
            <span className="text-2xl font-bold tracking-wide text-promo">找回密码</span>
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {tab === "password" ? (
          <>
            {notice && (
              <p className="rounded-lg bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-600">
                {notice}
              </p>
            )}
            <input
              id="account"
              type="text"
              required
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="邮箱 / 手机号"
              className={inputClass}
            />
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
                onClick={() => switchTab("reset")}
                className="absolute top-1/2 right-5 -translate-y-1/2 text-xs text-black/45 hover:text-promo dark:text-white/45"
              >
                忘记密码
              </button>
            </div>
            {fieldErrors.account && <p className="text-xs text-red-500">{fieldErrors.account}</p>}
            {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
          </>
        ) : tab === "sms" ? (
          <>
            <input
              id="smsPhone"
              type="tel"
              required
              inputMode="numeric"
              maxLength={11}
              value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="请输入手机号"
              className={inputClass}
            />
            <div className="relative">
              <input
                id="smsCode"
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                placeholder="请输入 6 位验证码"
                className={inputClass + " pr-28"}
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={countdown > 0}
                className="absolute top-1/2 right-4 -translate-y-1/2 text-xs text-promo disabled:opacity-40"
              >
                {countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
              </button>
            </div>
            {mockCode && (
              <p className="rounded-lg bg-mist px-4 py-2.5 text-xs dark:bg-white/10">
                📩 模拟短信已发送（演示环境不发真实短信）：验证码{" "}
                <span className="font-mono font-bold text-promo">{mockCode}</span>，输入它即可登录；
                未注册的手机号将自动创建账号
              </p>
            )}
          </>
        ) : (
          <>
            <input
              id="resetPhone"
              type="tel"
              required
              inputMode="numeric"
              maxLength={11}
              value={resetPhone}
              onChange={(e) => setResetPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="请输入注册时的手机号"
              className={inputClass}
            />
            <div className="relative">
              <input
                id="resetCode"
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                placeholder="请输入 6 位验证码"
                className={inputClass + " pr-28"}
              />
              <button
                type="button"
                onClick={sendResetCode}
                disabled={countdown > 0}
                className="absolute top-1/2 right-4 -translate-y-1/2 text-xs text-promo disabled:opacity-40"
              >
                {countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
              </button>
            </div>
            {resetMockCode && (
              <p className="rounded-lg bg-mist px-4 py-2.5 text-xs dark:bg-white/10">
                📩 模拟短信已发送（演示环境不发真实短信）：验证码{" "}
                <span className="font-mono font-bold text-promo">{resetMockCode}</span>
                ，输入它即可设置新密码
              </p>
            )}
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              maxLength={64}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="设置新密码（至少 8 位）"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => switchTab("password")}
              className="self-start text-xs text-black/45 hover:text-promo dark:text-white/45"
            >
              ← 想起密码了，返回登录
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-promo py-4 text-lg font-bold tracking-[0.3em] text-white transition-colors hover:bg-promo-deep disabled:opacity-50"
        >
          {submitting ? "处理中…" : tab === "reset" ? "重置密码" : "登录"}
        </button>
      </form>

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

      {/* 演示账号速查 */}
      <div className="mt-6 rounded-xl bg-mist p-4 text-xs leading-6 dark:bg-white/10">
        <p className="mb-1 font-semibold opacity-70">演示账号速查（密码同账号前缀）</p>
        <p className="font-mono opacity-70">
          用户 demo@example.com / demo123456
          <br />
          商家 merchant@example.com / merchant123456
          <br />
          管理员 admin@example.com / admin123456
        </p>
      </div>
    </main>
  );
}
