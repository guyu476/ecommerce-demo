// 商品详情骨架屏：相框 + 价格 + 描述 + 评价区的占位
export default function ProductLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="skeleton mb-6 h-4 w-40 rounded" />
      <div className="grid gap-14 sm:grid-cols-2">
        <div className="skeleton aspect-square rounded-lg" />
        <div className="space-y-6">
          <div className="skeleton h-8 w-4/5 rounded" />
          <div className="skeleton h-12 w-36 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
          <div className="skeleton h-20 rounded" />
          <div className="skeleton h-12 w-44 rounded-full" />
        </div>
      </div>
      <div className="mt-16 space-y-6">
        <div className="skeleton h-6 w-36 rounded" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4">
            <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-28 rounded" />
              <div className="skeleton h-4 w-3/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
