// 统一接口响应结构
// 成功：{ code: 0, message: "ok", data: T }
// 失败：{ code: 非零业务码, message: 错误信息, data: 字段错误明细或 null }

export interface ApiSuccess<T> {
  code: 0;
  message: string;
  data: T;
}

export interface ApiFailure {
  code: number;
  message: string;
  data: Record<string, string> | null;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;

/** 类型守卫：收窄到成功分支，之后 result.data 的类型是 T */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.code === 0;
}
