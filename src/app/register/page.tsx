"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ApiResponse } from "@/types/api";

// 注册页：注册成功即自动登录（后端直接种会话 cookie）
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", nickname: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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

  const fields = [
    { key: "email" as const, label: "邮箱", type: "email", placeholder: "you@example.com" },
    { key: "nickname" as const, label: "昵称", type: "text", placeholder: "怎么称呼你" },
    { key: "password" as const, label: "密码（至少 8 位）", type: "password", placeholder: "" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="mb-6 text-center text-2xl font-bold">注册</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-sm opacity-70" htmlFor={field.key}>
              {field.label}
            </label>
            <input
              id={field.key}
              type={field.type}
              required
              value={form[field.key]}
              onChange={update(field.key)}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
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
          className="w-full rounded-full bg-promo py-2.5 font-medium text-white transition-colors hover:bg-promo-deep disabled:opacity-50"
        >
          {submitting ? "注册中…" : "注册并登录"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm opacity-70">
        已有账号？{" "}
        <Link href="/login" className="text-promo hover:underline">
          去登录
        </Link>
      </p>
    </main>
  );
}
