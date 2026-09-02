import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiFailure, ApiSuccess } from "@/types/api";

/**
 * 业务错误：路由内主动抛出，由 handleRoute 统一转换为响应。
 * 例如：throw new ApiError("商品不存在", 40401, 404);
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code = 1,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 成功响应 */
export function ok<T>(data: T, message = "ok"): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ code: 0, message, data });
}

/** 失败响应 */
export function fail(
  message: string,
  code = 1,
  status = 400,
  fieldErrors: Record<string, string> | null = null,
): NextResponse<ApiFailure> {
  return NextResponse.json({ code, message, data: fieldErrors }, { status });
}

/** 把 ZodError 摊平成「字段路径 -> 错误信息」，放进 data 返回给前端 */
function toFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * 路由处理统一入口：所有 API 路由的处理逻辑都包在 handleRoute 里，
 * 集中处理业务错误（ApiError）、参数校验错误（ZodError）和未知异常。
 */
export async function handleRoute(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.code, error.status);
    }
    if (error instanceof ZodError) {
      return fail("参数校验失败", 422, 422, toFieldErrors(error));
    }
    // Prisma 更新/删除目标不存在（P2025）
    if (isPrismaError(error, "P2025")) {
      return fail("数据不存在", 40404, 404);
    }
    console.error("[api] 未处理错误:", error);
    return fail("服务器内部错误", 500, 500);
  }
}

/** 判断是否为指定代码的 Prisma 已知错误（如 P2002 唯一约束冲突、P2025 记录不存在） */
export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
