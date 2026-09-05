import { handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/coupons/mine 我的优惠券（UNUSED 供结算挑选，USED/过期仅展示）

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const mine = await prisma.userCoupon.findMany({
      where: { userId: user.id },
      include: { coupon: true },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    return ok(
      mine.map((item) => ({
        id: item.id,
        status: item.status,
        usedAt: item.usedAt,
        claimedAt: item.createdAt,
        expired: item.coupon.expiresAt < now,
        title: item.coupon.title,
        threshold: String(item.coupon.threshold),
        discount: String(item.coupon.discount),
        expiresAt: item.coupon.expiresAt,
      })),
    );
  });
}
