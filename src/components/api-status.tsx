"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@/types/api";

type HealthData = {
  service: string;
  status: string;
  timestamp: string;
};

// 首页状态卡片：请求 /api/health，直观展示统一响应格式是否生效
export function ApiStatus() {
  const [result, setResult] = useState<ApiResponse<HealthData> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setResult)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return <p className="text-sm text-red-500">/api/health 请求失败，服务未启动？</p>;
  }

  if (!result) {
    return <p className="text-sm opacity-60">检查 /api/health 中…</p>;
  }

  const success = result.code === 0;
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/20 p-4 text-left font-mono text-xs space-y-2">
      <p className="flex items-center gap-2 font-sans text-sm">
        <span
          className={`inline-block h-2 w-2 rounded-full ${success ? "bg-green-500" : "bg-red-500"}`}
        />
        {success ? "接口规范已生效" : "接口异常"}
      </p>
      <pre className="whitespace-pre-wrap break-all opacity-80">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
