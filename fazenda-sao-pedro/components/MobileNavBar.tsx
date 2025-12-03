import React from 'react';
import { CalendarDaysIcon, ClipboardDocumentCheckIcon, MapPinIcon, PlusIcon, ScaleIcon } from './common/Icons';

type ViewType = 'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management' | 'batches';

interface MobileNavBarProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
    onAddAnimalClick: () => void;
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
        className={`flex flex-col items-center justify-center flex-1 py-1.5 text-[10px] transition-colors ${
            isActive ? 'text-brand-primary-light' : 'text-gray-400 hover:text-white'
        }`}
    >
        <div className="mb-0.5">
            {children}
        </div>
        <span className="leading-tight">{label}</span>
    </button>
);

const AddAnimalButton = ({ onClick }: { onClick: () => void }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center justify-center px-3 py-2 bg-brand-primary text-white rounded-xl shadow-lg flex-none transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-dark focus:ring-offset-base-800"
        aria-label="Cadastrar animal"
    >
        <PlusIcon className="w-6 h-6 mb-0.5" />
        <span className="text-[10px] font-semibold leading-tight">Animal</span>
    </button>
);

// Ícone de Home
const HomeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
);

const MobileNavBar = ({ currentView, setCurrentView, onAddAnimalClick }: MobileNavBarProps) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
            {/* Barra de navegação principal */}
            <div className="relative bg-base-800 border-t border-base-700 safe-area-bottom pb-4 pt-2">
                <nav className="flex items-center h-16 px-2 gap-1">
                    <div className="flex flex-1 justify-evenly gap-1">
                        <NavButton view="dashboard" label="Painel" isActive={currentView === 'dashboard'} onClick={setCurrentView}>
                            <HomeIcon className="w-5 h-5" />
                        </NavButton>
                        <NavButton view="management" label="Manejo" isActive={currentView === 'management'} onClick={setCurrentView}>
                            <MapPinIcon className="w-5 h-5" />
                        </NavButton>
                        <NavButton view="batches" label="Lotes" isActive={currentView === 'batches'} onClick={setCurrentView}>
                            <ScaleIcon className="w-5 h-5" />
                        </NavButton>
                        <NavButton view="calendar" label="Agenda" isActive={currentView === 'calendar'} onClick={setCurrentView}>
                            <CalendarDaysIcon className="w-5 h-5" />
                        </NavButton>
                        <NavButton view="tasks" label="Tarefas" isActive={currentView === 'tasks'} onClick={setCurrentView}>
                            <ClipboardDocumentCheckIcon className="w-5 h-5" />
                        </NavButton>
                    </div>

                    <AddAnimalButton onClick={onAddAnimalClick} />
                </nav>
            </div>
        </div>
    );
};

export default MobileNavBar;