import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";

// POST /api/upload 图片上传（商家商品图用；multipart/form-data，字段名 file）
// 演示版存本地 public/uploads 并直接以静态路径访问；生产建议换对象存储 + CDN，
// 届时仅需替换本文件的存储实现，返回的 url 形态不变（商品图字段本就支持本站路径）。

const MAX_SIZE = 5 * 1024 * 1024; // 5MB（前端还会先压缩一遍）

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireRole("MERCHANT", "ADMIN");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("缺少文件字段 file", 40002, 400);
    }
    const ext = MIME_EXT[file.type];
    if (!ext) {
      throw new ApiError("仅支持 jpg / png / webp / gif 图片", 42202, 422);
    }
    if (file.size > MAX_SIZE) {
      throw new ApiError("图片不能超过 5MB", 42202, 422);
    }

    const filename = `${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

    return ok({ url: `/uploads/${filename}` }, "上传成功");
  });
}
