// ==========================================
// Terminal Tabs Component
// Renders the tab bar with individual tabs,
// close buttons, and a new-tab button.
// ==========================================

import { Plus, X, TerminalSquare } from "lucide-react";
import { useTerminalStore, createTab } from "../../stores/terminalStore";

export function TerminalTabs() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } =
    useTerminalStore();

  const handleNewTab = () => {
    const tab = createTab();
    addTab(tab);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <TerminalSquare size={13} strokeWidth={2} />
          <span>{tab.title}</span>
          {tabs.length > 1 && (
            <button
              className="close-btn"
              onClick={(e) => handleCloseTab(e, tab.id)}
              aria-label={`Close ${tab.title}`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}

      <button
        className="new-tab-btn"
        onClick={handleNewTab}
        aria-label="New terminal tab"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
