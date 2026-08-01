export type OperationsPage =
  | "overview"
  | "calendar"
  | "contents"
  | "finance"
  | "accounts"
  | "reviews"
  | "sources"
  | "settings";

export const OPERATIONS_NAVIGATION: Array<{
  id: OperationsPage;
  label: string;
  icon: string;
}> = [
  { id: "overview", label: "经营总览", icon: "⌂" },
  { id: "calendar", label: "内容日历", icon: "□" },
  { id: "contents", label: "内容库", icon: "▱" },
  { id: "finance", label: "收入管理", icon: "¥" },
  { id: "accounts", label: "账号资产", icon: "◎" },
  { id: "reviews", label: "复盘实验", icon: "◇" },
  { id: "sources", label: "数据导入与同步", icon: "⇄" },
  { id: "settings", label: "设置", icon: "⌘" },
];

export function DesktopSidebar({
  activePage,
  onNavigate,
}: {
  activePage: OperationsPage;
  onNavigate(page: OperationsPage): void;
}) {
  return (
    <aside className="operations-sidebar" aria-label="应用侧栏">
      <div className="operations-brand">
        <span>矩</span>
        <div><strong>矩阵罗盘</strong><small>创作者经营实验室</small></div>
      </div>
      <p>经营工作台</p>
      <nav aria-label="主导航">
        {OPERATIONS_NAVIGATION.slice(0, 6).map((item) => (
          <button
            type="button"
            key={item.id}
            data-icon={item.icon}
            aria-label={item.label}
            aria-current={activePage === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="operations-system-nav">
        {OPERATIONS_NAVIGATION.slice(6).map((item) => (
          <button
            type="button"
            key={item.id}
            data-icon={item.icon}
            aria-label={item.label}
            aria-current={activePage === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
