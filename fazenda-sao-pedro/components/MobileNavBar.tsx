import React from 'react';
import { CalendarDaysIcon, ClipboardDocumentCheckIcon, MapPinIcon, PlusIcon, ScaleIcon } from './common/Icons';
type ViewType = 'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management' | 'batches' | 'breeding';

interface MobileNavBarProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
    onAddAnimalClick?: () => void;
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
            relative flex flex-col items-center justify-center py-1
            transition-all duration-200 min-w-[48px]
            ${isActive 
                ? 'text-brand-primary-light' 
                : 'text-gray-500 active:text-gray-300'
            }
        `}
    >
        {/* Indicador ativo */}
        {isActive && (
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-brand-primary rounded-full" />
        )}
        
        <div className={`
            p-1 rounded-lg transition-all duration-200
            ${isActive ? 'bg-brand-primary/10' : ''}
        `}>
            {children}
        </div>
        <span className={`
            text-[9px] mt-0.5 font-medium transition-all leading-tight
            ${isActive ? 'text-brand-primary-light' : 'text-gray-500'}
        `}>
            {label}
        </span>
    </button>
);

const HomeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
);

// Ícone de Estação de Monta (coração com símbolo de reprodução)
const BreedingIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
);

const MobileNavBar = ({ currentView, setCurrentView, onAddAnimalClick }: MobileNavBarProps) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
            {/* Background com blur */}
            <div className="absolute inset-0 bg-base-900/95 backdrop-blur-lg border-t border-base-700/50" />
            
            {/* Navigation - todos os itens + botão à direita */}
            <nav className="relative flex items-center justify-between h-16 px-2">
                {/* Itens de navegação */}
                <div className="flex items-center justify-around flex-1">
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

                    <NavButton view="breeding" label="Monta" isActive={currentView === 'breeding'} onClick={setCurrentView}>
                        <BreedingIcon className="w-5 h-5" />
                    </NavButton>

                </div>

                {/* Botão de adicionar animal - à direita */}
                {onAddAnimalClick && (
                    <button
                        onClick={onAddAnimalClick}
                        className="
                            flex items-center justify-center
                            w-12 h-12 ml-2
                            bg-brand-primary
                            text-white rounded-xl
                            shadow-lg shadow-brand-primary/30
                            transition-all duration-200
                            active:scale-95 active:bg-brand-primary-light
                        "
                        aria-label="Cadastrar animal"
                    >
                        <PlusIcon className="w-6 h-6" />
                    </button>
                )}
            </nav>
            
            {/* Safe area padding for iPhone */}
            <div className="h-safe bg-base-900/95" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
    );
};

export default MobileNavBar;