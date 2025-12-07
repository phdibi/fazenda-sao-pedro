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
        className={`
            relative flex flex-col items-center justify-center flex-1 py-2 
            transition-all duration-200
            ${isActive 
                ? 'text-brand-primary-light' 
                : 'text-gray-500 active:text-gray-300'
            }
        `}
    >
        {/* Indicador ativo */}
        {isActive && (
            <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-primary rounded-full" />
        )}
        
        <div className={`
            p-1.5 rounded-xl transition-all duration-200
            ${isActive ? 'bg-brand-primary/10' : ''}
        `}>
            {children}
        </div>
        <span className={`
            text-[10px] mt-0.5 font-medium transition-all
            ${isActive ? 'text-brand-primary-light' : 'text-gray-500'}
        `}>
            {label}
        </span>
    </button>
);

const AddAnimalButton = ({ onClick }: { onClick: () => void }) => (
    <button
        onClick={onClick}
        className="
            flex flex-col items-center justify-center 
            w-14 h-14 -mt-5
            bg-gradient-to-br from-brand-primary to-brand-accent-dark 
            text-white rounded-2xl 
            shadow-lg shadow-brand-primary/30
            transition-all duration-200 
            active:scale-95 active:shadow-md
            focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-base-800
        "
        aria-label="Cadastrar animal"
    >
        <PlusIcon className="w-6 h-6" />
    </button>
);

const HomeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
);

const MobileNavBar = ({ currentView, setCurrentView, onAddAnimalClick }: MobileNavBarProps) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
            {/* Backdrop blur */}
            <div className="absolute inset-0 bg-base-900/80 backdrop-blur-lg border-t border-base-700/50" />
            
            {/* Navigation */}
            <nav className="relative flex items-end justify-around h-16 px-2 pb-safe">
                {/* Left side */}
                <NavButton view="dashboard" label="Painel" isActive={currentView === 'dashboard'} onClick={setCurrentView}>
                    <HomeIcon className="w-5 h-5" />
                </NavButton>
                
                <NavButton view="management" label="Manejo" isActive={currentView === 'management'} onClick={setCurrentView}>
                    <MapPinIcon className="w-5 h-5" />
                </NavButton>

                {/* Center - FAB */}
                <div className="flex-1 flex justify-center">
                    <AddAnimalButton onClick={onAddAnimalClick} />
                </div>

                {/* Right side */}
                <NavButton view="calendar" label="Agenda" isActive={currentView === 'calendar'} onClick={setCurrentView}>
                    <CalendarDaysIcon className="w-5 h-5" />
                </NavButton>
                
                <NavButton view="tasks" label="Tarefas" isActive={currentView === 'tasks'} onClick={setCurrentView}>
                    <ClipboardDocumentCheckIcon className="w-5 h-5" />
                </NavButton>
            </nav>
            
            {/* Safe area padding for iPhone */}
            <div className="h-safe bg-base-900/80 backdrop-blur-lg" />
        </div>
    );
};

export default MobileNavBar;