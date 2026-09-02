// 数据库未就绪时的引导提示（首页 / 详情页共用）
export function DbSetupNotice() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
      <h2 className="mb-2 font-semibold">数据库还没有连接</h2>
      <p className="mb-3 opacity-80">
        页面和接口都正常，只差最后一步：在 .env 里把 DATABASE_URL 中的 PASSWORD 换成你的 MySQL
        密码，然后执行：
      </p>
      <pre className="rounded-md bg-black/5 p-3 font-mono text-xs dark:bg-white/10">
        npm run db:migrate
        {"\n"}
        npm run db:seed
      </pre>
      <p className="mt-3 opacity-60">完成后刷新本页即可看到商品数据。</p>
    </div>
  );
}
