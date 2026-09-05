import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, isPrismaError, ok } from "@/lib/api-response";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============ 优惠券 ============
// GET  /api/coupons       券模板列表（登录后附带是否已领取；未登录也能逛）
// POST /api/coupons/claim 领取 { couponId }（限领一张，总数条件扣减防超发）
// GET  /api/coupons/mine  我的券（含模板信息，结算页与我的优惠券页共用）

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await getSessionUser();

    const [coupons, myClaimedCouponIds] = await Promise.all([
      prisma.coupon.findMany({ orderBy: { id: "asc" } }),
      user
        ? prisma.userCoupon.findMany({ where: { userId: user.id }, select: { couponId: true } })
        : Promise.resolve([]),
    ]);

    const now = new Date();
    const claimedSet = new Set(myClaimedCouponIds.map((item) => item.couponId));
    return ok(
      coupons.map((coupon) => ({
        id: coupon.id,
        title: coupon.title,
        threshold: String(coupon.threshold),
        discount: String(coupon.discount),
        remaining: Math.max(0, coupon.totalCount - coupon.claimedCount),
        expired: coupon.expiresAt < now,
        claimed: claimedSet.has(coupon.id),
      })),
    );
  });
}

const claimBodySchema = z.object({
  couponId: z.coerce.number().int().positive(),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await getSessionUser();
    if (!user) {
      throw new ApiError("登录后才能领券", 40101, 401);
    }
    const { couponId } = claimBodySchema.parse(await request.json());

    try {
      const userCoupon = await prisma.$transaction(async (tx) => {
        const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
        if (!coupon) {
          throw new ApiError("优惠券不存在", 40404, 404);
        }
        if (coupon.expiresAt < new Date()) {
          throw new ApiError("该券已过期", 40906, 409);
        }

        // 条件更新占名额：claimedCount 与读取时刻一致才 +1，并发下只有一个请求生效（防超发）
        const updated = await tx.coupon.updateMany({
          where: { id: couponId, claimedCount: coupon.claimedCount },
          data: { claimedCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new ApiError("手慢了，券已被领完", 40906, 409);
        }

        return tx.userCoupon.create({
          data: { userId: user.id, couponId },
          include: { coupon: true },
        });
      });

      return ok(
        {
          id: userCoupon.id,
          title: userCoupon.coupon.title,
          threshold: String(userCoupon.coupon.threshold),
          discount: String(userCoupon.coupon.discount),
        },
        "领取成功",
      );
    } catch (error) {
      // 唯一约束：同一张券每人限领一张（并发重复领取在此兜底）
      if (isPrismaError(error, "P2002")) {
        throw new ApiError("已经领过这张券啦", 40906, 409);
      }
      throw error;
    }
  });
}
