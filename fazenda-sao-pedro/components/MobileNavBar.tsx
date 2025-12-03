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
                {/* Botão de Adicionar Animal - FAB central elevado */}
                <div className="absolute left-1/2 -top-5 -translate-x-1/2">
                    <button
                        onClick={onAddAnimalClick}
                        className="w-14 h-14 bg-brand-primary hover:bg-brand-primary-light text-white rounded-full shadow-lg flex items-center justify-center transform transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-dark focus:ring-offset-base-800"
                        aria-label="Adicionar novo animal"
                    >
                        <PlusIcon className="w-7 h-7" />
                    </button>
                </div>

                <nav className="flex items-center h-16 px-2 gap-1">
                    {/* Itens à esquerda */}
                    <div className="flex flex-1 justify-evenly">
                        <NavButton view="dashboard" label="Painel" isActive={currentView === 'dashboard'} onClick={setCurrentView}>
                            <HomeIcon className="w-5 h-5" />
                        </NavButton>
                        <NavButton view="management" label="Manejo" isActive={currentView === 'management'} onClick={setCurrentView}>
                            <MapPinIcon className="w-5 h-5" />
                        </NavButton>
                    </div>

                    {/* Espaço central para destacar o FAB sem comprimir os ícones */}
                    <div className="w-16 flex-shrink-0" aria-hidden />

                    {/* Itens à direita */}
                    <div className="flex flex-1 justify-evenly">
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
                </nav>
            </div>
        </div>
    );
};

export default MobileNavBar;