"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ApiResponse } from "@/types/api";

// 注册页（与登录页同风格 · Tab 头部 + 灰底大输入框 + 协议勾选）
// 注册成功即自动登录（后端直接种会话 cookie）
export default function RegisterPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [form, setForm] = useState({ email: "", nickname: "", password: "" });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await res.json()) as ApiResponse;

      if (result.code !== 0) {
        setError(result.message);
        if (result.data) setFieldErrors(result.data as Record<string, string>);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl bg-mist px-5 py-4 text-sm outline-none transition-shadow placeholder:text-black/35 focus:ring-2 focus:ring-promo/30 dark:bg-white/10 dark:placeholder:text-white/35";

  const fields = [
    { key: "email" as const, type: "email", placeholder: "请输入邮箱" },
    { key: "nickname" as const, type: "text", placeholder: "请输入昵称" },
    { key: "password" as const, type: "password", placeholder: "请设置登录密码（至少 8 位）" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      {/* 注册方式 Tab（与登录页同款） */}
      <div className="mb-10 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => setTab("email")}
          className={`text-2xl font-bold tracking-wide transition-colors ${
            tab === "email" ? "text-promo" : "text-black/35 hover:text-black/60 dark:text-white/40"
          }`}
        >
          邮箱注册
        </button>
        <span className="h-6 w-px bg-black/15 dark:bg-white/20" aria-hidden />
        <button
          type="button"
          onClick={() => setTab("phone")}
          className={`text-2xl font-bold tracking-wide transition-colors ${
            tab === "phone" ? "text-promo" : "text-black/35 hover:text-black/60 dark:text-white/40"
          }`}
        >
          手机注册
        </button>
      </div>

      {tab === "phone" ? (
        <p className="rounded-xl bg-mist p-8 text-center text-sm leading-6 opacity-70 dark:bg-white/10">
          演示环境暂未开通手机注册
          <br />
          请切换到「邮箱注册」
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <input
                id={field.key}
                type={field.type}
                required
                value={form[field.key]}
                onChange={update(field.key)}
                placeholder={field.placeholder}
                className={inputClass}
              />
              {fieldErrors[field.key] && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors[field.key]}</p>
              )}
            </div>
          ))}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-promo py-4 text-lg font-bold tracking-[0.3em] text-white transition-colors hover:bg-promo-deep disabled:opacity-50"
          >
            {submitting ? "注册中…" : "注 册"}
          </button>
        </form>
      )}

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

      <div className="mt-6 flex items-center justify-center gap-4 text-sm">
        <span className="opacity-50">已有账号</span>
        <span className="h-3.5 w-px bg-black/15 dark:bg-white/20" aria-hidden />
        <Link href="/login" className="font-medium text-promo hover:underline">
          去登录
        </Link>
      </div>
    </main>
  );
}
