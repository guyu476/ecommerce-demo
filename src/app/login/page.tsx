"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ApiResponse } from "@/types/api";

// 登录页：?redirect=/path 登录成功后跳回原页面
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
      <h1 className="mb-6 text-center text-2xl font-bold">登录</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm opacity-70" htmlFor="email">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="demo@example.com"
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm opacity-70" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-promo py-2.5 font-medium text-white transition-colors hover:bg-promo-deep disabled:opacity-50"
        >
          {submitting ? "登录中…" : "登录"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm opacity-70">
        还没有账号？{" "}
        <Link href="/register" className="text-promo hover:underline">
          立即注册
        </Link>
      </p>
      <p className="mt-2 text-center text-xs opacity-50">演示账号：demo@example.com / demo123456</p>
    </main>
  );
}
