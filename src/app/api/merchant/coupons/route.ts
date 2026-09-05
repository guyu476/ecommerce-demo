import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============ 店铺优惠券（商家发券） ============
// GET  /api/merchant/coupons        我店铺发的券（含领取进度）
// POST /api/merchant/coupons        发一张店铺券（需已开店；限本店商品满减，下单时按本店小计校验门槛）
// DELETE /api/merchant/coupons/[id] 撤下还没人领的券（有人领过就不能删）

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
    const user = await requireRole("MERCHANT", "ADMIN");

    const coupons = await prisma.coupon.findMany({
      where: user.role === "MERCHANT" ? { ownerId: user.id } : {},
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
        deletable: coupon.claimedCount === 0,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT");
    const body = createCouponSchema.parse(await request.json());

    // 店铺券挂在我的店铺名下（下单校验本店商品小计时需要）
    const shop = await prisma.shop.findUnique({ where: { ownerId: user.id } });
    if (!shop) {
      throw new ApiError("请先在上方「开设店铺」再发店铺券", 40907, 409);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + body.validDays);

    const coupon = await prisma.coupon.create({
      data: {
        title: body.title,
        threshold: body.threshold,
        discount: body.discount,
        totalCount: body.totalCount,
        expiresAt,
        ownerId: user.id,
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
      "发券成功，买家可在领券中心领取",
    );
  });
}
