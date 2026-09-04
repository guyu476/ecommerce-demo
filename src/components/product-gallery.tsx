"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

// 商品多图相册：主图左右箭头切换 + 缩略图 + 点击放大（灯箱）
// 图片数量 = 商家上传数量；未上传时显示浅黑色占位
export function ProductGallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  if (images.length === 0) {
    return <div className="aspect-square rounded-md bg-zinc-800" />;
  }

  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);

  const arrowClass =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-lg text-white backdrop-blur transition-colors hover:bg-black/55";

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={`商品图 ${active + 1}`}
          onClick={() => setZoomed(true)}
          className="h-full w-full cursor-zoom-in object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="上一张"
              onClick={prev}
              className={arrowClass + " left-2"}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="下一张"
              onClick={next}
              className={arrowClass + " right-2"}
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white">
              {active + 1}/{images.length}
            </span>
          </>
        )}
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

      {/* 灯箱：点击图片放大查看，点任意处关闭。Portal 渲染到 body，避免被旋转/裁剪祖先限制 */}
      {zoomed &&
        createPortal(
          <div
            role="dialog"
            aria-label="查看大图"
            onClick={() => setZoomed(false)}
            className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[active]}
              alt={`商品大图 ${active + 1}`}
              className="h-[min(92vmin,860px)] w-[min(92vmin,860px)] rounded-lg bg-white/5 object-contain shadow-2xl"
            />
            <button
              type="button"
              aria-label="关闭大图"
              onClick={() => setZoomed(false)}
              className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30"
            >
              ×
            </button>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="上一张"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  className={arrowClass + " left-4 sm:left-10"}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="下一张"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  className={arrowClass + " right-4 sm:right-8"}
                >
                  ›
                </button>
                <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 font-mono text-xs text-white">
                  {active + 1} / {images.length}
                </span>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
