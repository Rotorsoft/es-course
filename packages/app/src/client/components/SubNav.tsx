import type { Tab } from "../types.js";

const TABS: { id: Tab; label: string }[] = [
  { id: "shop", label: "Shop" },
  { id: "orders", label: "Orders" },
  { id: "admin", label: "Admin" },
  { id: "marketing", label: "Marketing" },
];

export function SubNav({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <nav className="subnav">
      {TABS.map((tab) => (
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
