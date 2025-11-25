import React from 'react';
import { DocumentChartBarIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, MapPinIcon } from './common/Icons';

type ViewType = 'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management';

interface MobileNavBarProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
}

interface NavButtonProps {
    view: ViewType;
    label: string;
    isActive: boolean;
    onClick: (view: ViewType) => void;
    children: React.ReactNode;
}

const NavButton = ({ view, label, isActive, onClick, children }: NavButtonProps) => (
    <button
        onClick={() => onClick(view)}
        className={`flex flex-col items-center justify-center flex-1 py-2 text-xs transition-colors ${
            isActive ? 'text-brand-primary-light' : 'text-gray-400 hover:text-white'
        }`}
    >
        {children}
        <span>{label}</span>
    </button>
);

const MobileNavBar = ({ currentView, setCurrentView }: MobileNavBarProps) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-base-800 border-t border-base-700 md:hidden">
            <nav className="flex justify-around items-center h-16">
                <NavButton view="dashboard" label="Painel" isActive={currentView === 'dashboard'} onClick={setCurrentView}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                </NavButton>
                <NavButton view="management" label="Manejo" isActive={currentView === 'management'} onClick={setCurrentView}>
                    <MapPinIcon className="w-6 h-6" />
                </NavButton>
                <NavButton view="calendar" label="Agenda" isActive={currentView === 'calendar'} onClick={setCurrentView}>
                    <CalendarDaysIcon className="w-6 h-6" />
                </NavButton>
                <NavButton view="tasks" label="Tarefas" isActive={currentView === 'tasks'} onClick={setCurrentView}>
                    <ClipboardDocumentCheckIcon className="w-6 h-6" />
                </NavButton>
                <NavButton view="reports" label="Relatórios" isActive={currentView === 'reports'} onClick={setCurrentView}>
                    <DocumentChartBarIcon className="w-6 h-6" />
                </NavButton>
            </nav>
        </div>
    );
};

export default MobileNavBar;
