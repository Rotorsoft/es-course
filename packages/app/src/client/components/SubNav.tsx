import type { Tab } from "../types.js";
import { useAuth } from "../hooks/useAuth.js";

const PUBLIC_TABS: { id: Tab; label: string }[] = [
  { id: "shop", label: "Shop" },
];

const AUTHED_TABS: { id: Tab; label: string }[] = [
  { id: "orders", label: "Orders" },
];

const ADMIN_TABS: { id: Tab; label: string }[] = [
  { id: "marketing", label: "Marketing" },
  { id: "admin", label: "Admin" },
];

export function SubNav({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const { isAdmin, user } = useAuth();
  const tabs = [
    ...PUBLIC_TABS,
    ...(user ? AUTHED_TABS : []),
    ...(isAdmin ? ADMIN_TABS : []),
  ];

  return (
    <nav className="subnav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`subnav-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
