"use client";

import { useState } from "react";

// 商品多图相册：主图 + 缩略图切换；无图时回退到分类 emoji 占位
export function ProductGallery({
  images,
  fallbackIcon,
}: {
  images: string[];
  fallbackIcon: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md bg-mist text-[130px] dark:bg-white/5">
        {fallbackIcon}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-md bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={`商品图 ${active + 1}`}
          className="h-full w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((image, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`查看第 ${i + 1} 张图`}
              className={`h-16 w-16 overflow-hidden rounded-md border-2 transition-all ${
                i === active ? "border-promo" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={`缩略图 ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
