import React from 'react';

export type TabName = 'general' | 'health' | 'weight' | 'biometry' | 'reproduction' | 'progeny' | 'genealogy';

interface TabButtonProps {
  tabName: TabName;
  label: string;
  activeTab: TabName;
  onClick: (tabName: TabName) => void;
}

export const TabButton: React.FC<TabButtonProps> = ({ tabName, label, activeTab, onClick }) => (
  <button
    onClick={() => onClick(tabName)}
    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
      activeTab === tabName
        ? 'bg-base-900 text-brand-primary-light border-b-2 border-brand-primary-light'
        : 'text-gray-400 hover:text-white'
    }`}
  >
    {label}
  </button>
);
