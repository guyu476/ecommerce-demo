// 商品图片解析（纯函数，客户端/服务端共用）
// JSON 数组格式：["/products/p1.jpg", "data:image/jpeg;base64,..."]

export function parseProductImagesPure(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed: unknown = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
