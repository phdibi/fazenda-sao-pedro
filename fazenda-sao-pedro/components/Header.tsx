import React, { useState } from 'react';
import { DocumentChartBarIcon, SparklesIcon, PlusIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, MapPinIcon } from './common/Icons';
import { AppUser } from '../types';
import { auth } from '../services/firebase';

type ViewType = 'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management';

interface HeaderProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
    onAddAnimalClick: () => void;
    user: AppUser;
    onForceSync?: () => Promise<void>;  // 👈 NOVA PROP
    lastSync?: number | null;            // 👈 NOVA PROP
}

interface NavButtonProps {
    view: ViewType;
    label: string;
    children: React.ReactNode;
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
}

const NavButton = ({ view, label, children, currentView, setCurrentView }: NavButtonProps) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`px-3 py-2 flex items-center gap-2 text-sm font-medium rounded-md transition-colors ${
        currentView === view ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-base-700 hover:text-white'
      }`}
    >
      {children}
      {label}
    </button>
);

// Ícone de refresh/sync
const RefreshIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || 'w-5 h-5'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);

const Header = ({ 
    currentView, 
    setCurrentView, 
    onAddAnimalClick, 
    user,
    onForceSync,
    lastSync 
}: HeaderProps) => {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleLogout = () => {
        if (auth) {
            auth.signOut();
        }
    };

    // Função para executar o sync com feedback visual
    const handleSync = async () => {
        if (!onForceSync || isSyncing) return;
        
        setIsSyncing(true);
        try {
            await onForceSync();
        } catch (error) {
            console.error('Erro ao sincronizar:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    // Formata a última sincronização
    const formatLastSync = () => {
        if (!lastSync) return 'Nunca sincronizado';
        
        const now = Date.now();
        const diff = now - lastSync;
        
        if (diff < 60000) return 'Agora mesmo';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
        
        return new Date(lastSync).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <header className="bg-base-800 shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center">
                        <SparklesIcon className="h-8 w-8 text-brand-primary-light" />
                        <span className="ml-3 text-xl font-bold text-white">São Pedro IA</span>
                    </div>

                    <div className="flex items-center">
                        {/* Navegação Desktop */}
                        <nav className="hidden md:flex space-x-1 sm:space-x-2">
                            <NavButton view="dashboard" label="Painel" currentView={currentView} setCurrentView={setCurrentView}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                </svg>
                            </NavButton>
                            <NavButton view="management" label="Manejo" currentView={currentView} setCurrentView={setCurrentView}>
                                <MapPinIcon className="h-5 w-5" />
                            </NavButton>
                            <NavButton view="calendar" label="Agenda" currentView={currentView} setCurrentView={setCurrentView}>
                                <CalendarDaysIcon className="h-5 w-5" />
                            </NavButton>
                            <NavButton view="tasks" label="Tarefas" currentView={currentView} setCurrentView={setCurrentView}>
                                <ClipboardDocumentCheckIcon className="h-5 w-5" />
                            </NavButton>
                            <NavButton view="reports" label="Relatórios" currentView={currentView} setCurrentView={setCurrentView}>
                                <DocumentChartBarIcon className="h-5 w-5" />
                            </NavButton>
                        </nav>

                        <div className="hidden md:block border-l border-base-600 mx-4 h-8"></div>

                        {/* ============================================ */}
                        {/* 🔄 BOTÃO DE SINCRONIZAÇÃO - NOVA FEATURE */}
                        {/* ============================================ */}
                        {onForceSync && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={`hidden md:flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-all mr-2 ${
                                    isSyncing 
                                        ? 'bg-brand-primary/20 text-brand-primary-light cursor-wait' 
                                        : 'text-gray-300 hover:text-white hover:bg-base-700'
                                }`}
                                title={`Última sync: ${formatLastSync()}`}
                            >
                                <RefreshIcon 
                                    className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} 
                                />
                                <span className="hidden lg:inline">
                                    {isSyncing ? 'Sincronizando...' : 'Sync'}
                                </span>
                            </button>
                        )}

                        {/* Botão Adicionar Animal */}
                        <div className="hidden md:block">
                            <button 
                                onClick={onAddAnimalClick} 
                                className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded transition-colors"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Adicionar Animal
                            </button>
                        </div>
                        
                        {/* Avatar e Logout */}
                        <div className="flex items-center ml-4">
                            <div className="relative">
                                <div className="flex items-center">
                                    <img 
                                        className="h-8 w-8 rounded-full" 
                                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=374151&color=fff`} 
                                        alt="User avatar" 
                                    />
                                    <div className="ml-3 hidden sm:block">
                                        <div className="text-sm font-medium text-white">{user.displayName}</div>
                                        {/* Indicador de última sync (mobile friendly) */}
                                        {lastSync && (
                                            <div className="text-xs text-gray-400">
                                                Sync: {formatLastSync()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={handleLogout} 
                                className="ml-4 text-gray-400 hover:text-white" 
                                title="Sair"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>

                        {/* Botão Mobile - Adicionar Animal */}
                        <div className="md:hidden ml-2">
                            <button 
                                onClick={onAddAnimalClick} 
                                className="flex-shrink-0 bg-brand-primary p-2 text-white rounded-full hover:bg-brand-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-800 focus:ring-white"
                            >
                                <PlusIcon className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Botão Mobile - Sync */}
                        {onForceSync && (
                            <div className="md:hidden ml-2">
                                <button 
                                    onClick={handleSync}
                                    disabled={isSyncing}
                                    className={`flex-shrink-0 p-2 rounded-full focus:outline-none ${
                                        isSyncing 
                                            ? 'bg-brand-primary/20 text-brand-primary-light' 
                                            : 'text-gray-400 hover:text-white hover:bg-base-700'
                                    }`}
                                >
                                    <RefreshIcon className={`h-6 w-6 ${isSyncing ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
