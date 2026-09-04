// 为现有商品重新生成贴合商品本身的主题图（SVG 海报：专属图形+名称+分类配色）
// 运行：npx tsx scripts/regen-product-images.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 每个商品的专属视觉：emoji 图形 + 分类配色渐变
const PRODUCT_VISUALS: Record<string, { emoji: string; from: string; to: string }> = {
  "星耀 X7 Pro 5G 手机 12GB+256GB": { emoji: "📱", from: "#1d3557", to: "#4361ee" },
  "降噪无线蓝牙耳机 AirPro 3": { emoji: "🎧", from: "#14213d", to: "#3a86ff" },
  "智能手表 Watch S2 运动版": { emoji: "⌚", from: "#0b132b", to: "#5bc0be" },
  "轻薄笔记本电脑 MateBook 14 英寸": { emoji: "💻", from: "#22223b", to: "#4a4e69" },
  "机械键盘 87 键 红轴": { emoji: "⌨️", from: "#2b2d42", to: "#8d99ae" },
  "4K 显示器 27 英寸 IPS": { emoji: "🖥️", from: "#1a2a3a", to: "#2ec4b6" },
  "变频空调 大1.5匹 新一级能效": { emoji: "❄️", from: "#118ab2", to: "#06d6a0" },
  "扫地机器人 扫拖一体": { emoji: "🤖", from: "#073b4c", to: "#118ab2" },
  "纯棉基础款圆领 T 恤": { emoji: "👕", from: "#e63946", to: "#ff9f1c" },
  轻商务休闲双肩包: { emoji: "🎒", from: "#bc4749", to: "#f2a65a" },
  "氨基酸保湿洁面乳 150ml": { emoji: "🧴", from: "#a06cd5", to: "#e5b3fe" },
  "阿克苏冰糖心苹果 5kg 装": { emoji: "🍎", from: "#c1121f", to: "#780000" },
};

const DECORS = ["官方正品", "品质保障", "鸟西精选"];

function buildPoster(emoji: string, name: string, from: string, to: string, decor: string): string {
  // 名称过长时拆两行
  const line1 = name.length > 9 ? name.slice(0, 9) : name;
  const line2 = name.length > 9 ? name.slice(9, 18) : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="400" height="400" fill="url(#g)"/>` +
    `<circle cx="340" cy="60" r="100" fill="#ffffff" opacity="0.10"/>` +
    `<circle cx="50" cy="350" r="70" fill="#ffffff" opacity="0.08"/>` +
    `<rect x="24" y="24" width="352" height="352" fill="none" stroke="#ffffff" stroke-opacity="0.35" rx="18"/>` +
    `<text x="200" y="215" font-size="130" text-anchor="middle">${emoji}</text>` +
    `<text x="200" y="288" font-size="24" font-weight="bold" text-anchor="middle" fill="#ffffff">${line1}</text>` +
    (line2
      ? `<text x="200" y="318" font-size="24" font-weight="bold" text-anchor="middle" fill="#ffffff">${line2}</text>`
      : "") +
    `<text x="200" y="352" font-size="16" text-anchor="middle" fill="#ffffff" opacity="0.8">${decor} · 鸟西商城</text>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  let updated = 0;
  for (const product of products) {
    const visual = PRODUCT_VISUALS[product.name];
    if (!visual) {
      console.log("跳过（无定制视觉）:", product.name);
      continue;
    }
    const images = DECORS.map((decor, i) =>
      buildPoster(visual.emoji, product.name, visual.from, visual.to, i === 0 ? decor : DECORS[i]),
    );
    await prisma.product.update({
      where: { id: product.id },
      data: { images: JSON.stringify(images) },
    });
    updated += 1;
  }

  console.log(`已为 ${updated} 个商品生成定制主题图`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
