import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============ 平台优惠券（管理员发券） ============
// GET  /api/admin/coupons        全平台券列表（含发券方：平台 / 店铺名）
// POST /api/admin/coupons        发平台券（全店通用）
// DELETE /api/admin/coupons/[id] 撤下还没人领的券

export const dynamic = "force-dynamic";

const createCouponSchema = z
  .object({
    title: z.string().trim().min(2, "券标题至少 2 个字").max(100, "券标题最多 100 字"),
    threshold: z.coerce.number().min(0.01, "门槛必须大于 0"),
    discount: z.coerce.number().min(0.01, "面额必须大于 0"),
    totalCount: z.coerce.number().int().min(1, "至少发 1 张").max(100000, "单次最多发 10 万张"),
    validDays: z.coerce.number().int().min(1, "至少有效 1 天").max(365, "最多有效 365 天"),
  })
  .refine((data) => data.discount <= data.threshold, {
    message: "面额不能超过门槛（满减券至少要满减）",
    path: ["discount"],
  });

export async function GET() {
  return handleRoute(async () => {
    await requireRole("ADMIN");

    const coupons = await prisma.coupon.findMany({
      include: {
        owner: { select: { nickname: true, shop: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    return ok(
      coupons.map((coupon) => ({
        id: coupon.id,
        title: coupon.title,
        threshold: String(coupon.threshold),
        discount: String(coupon.discount),
        totalCount: coupon.totalCount,
        claimedCount: coupon.claimedCount,
        remaining: Math.max(0, coupon.totalCount - coupon.claimedCount),
        expired: coupon.expiresAt < now,
        expiresAt: coupon.expiresAt,
        // 发券方：ownerId 为空 = 平台券；店铺券展示店名
        scope: coupon.ownerId === null ? "platform" : "shop",
        scopeLabel:
          coupon.ownerId === null
            ? "平台券"
            : (coupon.owner?.shop?.name ?? coupon.owner?.nickname ?? "店铺券"),
        deletable: coupon.claimedCount === 0,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireRole("ADMIN");
    const body = createCouponSchema.parse(await request.json());

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + body.validDays);

    const coupon = await prisma.coupon.create({
      data: {
        title: body.title,
        threshold: body.threshold,
        discount: body.discount,
        totalCount: body.totalCount,
        expiresAt,
        // 平台券：无发券方
      },
    });

    return ok(
      {
        id: coupon.id,
        title: coupon.title,
        threshold: String(coupon.threshold),
        discount: String(coupon.discount),
        totalCount: coupon.totalCount,
      },
      "平台券已发布，买家可在领券中心领取",
    );
  });
}
