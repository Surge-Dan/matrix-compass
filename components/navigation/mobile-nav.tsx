import type { OperationsPage } from "./desktop-sidebar";

const MOBILE_NAVIGATION: Array<{ id: OperationsPage; label: string; icon: string }> = [
  { id: "overview", label: "总览", icon: "⌂" },
  { id: "calendar", label: "日程", icon: "□" },
  { id: "contents", label: "内容", icon: "▱" },
  { id: "finance", label: "收入", icon: "¥" },
  { id: "sources", label: "更多", icon: "•••" },
];

export function MobileNav({
  activePage,
  onNavigate,
}: {
  activePage: OperationsPage;
  onNavigate(page: OperationsPage): void;
}) {
  return (
    <nav className="operations-mobile-nav" aria-label="移动端主导航">
      {MOBILE_NAVIGATION.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-current={activePage === item.id ? "page" : undefined}
          onClick={() => onNavigate(item.id)}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
