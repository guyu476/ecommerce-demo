// 首页骨架屏：模拟「轮播 + 分类 + 商品网格」的版式，加载期间占位防跳动
export default function HomeLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-8 py-12">
      <div className="skeleton h-72 rounded-2xl" />
      <div className="flex flex-wrap gap-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-11 w-28 rounded-lg" />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="space-y-3">
            <div className="skeleton aspect-square rounded-xl" />
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-5 w-1/3 rounded" />
          </li>
        ))}
      </ul>
    </main>
  );
}
