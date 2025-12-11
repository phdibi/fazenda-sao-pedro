import React, { useState } from 'react';
import { DocumentChartBarIcon, PlusIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, MapPinIcon, ScaleIcon } from './common/Icons';
import { AppUser, UserRole } from '../types';
import { auth } from '../services/firebase';

type ViewType = 'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management' | 'batches';

interface HeaderProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
    onAddAnimalClick?: () => void;
    user: AppUser;
    onForceSync?: () => Promise<void>;
    lastSync?: number | null;
    userRole?: UserRole;
    onRoleClick?: () => void;
}

const roleLabels: Record<UserRole, { icon: string; label: string }> = {
    [UserRole.Proprietario]: { icon: '👑', label: 'Proprietário' },
    [UserRole.Capataz]: { icon: '👷', label: 'Capataz' },
    [UserRole.Veterinario]: { icon: '🩺', label: 'Veterinário' },
    [UserRole.Funcionario]: { icon: '🧑‍🌾', label: 'Funcionário' },
};

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
      className={`px-3 py-2 flex items-center gap-2 text-sm font-medium rounded-lg transition-all ${
        currentView === view 
          ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' 
          : 'text-gray-300 hover:bg-base-700 hover:text-white'
      }`}
    >
      {children}
      {label}
    </button>
);

const RefreshIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || 'w-5 h-5'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

const Header = ({ 
    currentView, 
    setCurrentView, 
    onAddAnimalClick,
    user,
    onForceSync,
    lastSync,
    userRole = UserRole.Proprietario,
    onRoleClick
}: HeaderProps) => {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleLogout = () => {
        if (auth) auth.signOut();
    };

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

    const formatLastSync = () => {
        if (!lastSync) return 'Nunca';
        const diff = Date.now() - lastSync;
        if (diff < 60000) return 'Agora';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
        return new Date(lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const roleInfo = roleLabels[userRole];

    return (
        <header className="header-gradient shadow-lg border-b border-base-700/50">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
                {/* 🔧 LAYOUT: Mobile 48px, Desktop 64px */}
                <div className="flex items-center justify-between h-12 md:h-16">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <img 
                            src="/logo.png" 
                            alt="Fazenda+" 
                            className="h-8 md:h-11 w-auto cow-logo"
                        />
                        {/* Título - apenas desktop */}
                        <div className="hidden lg:block">
                            <h1 className="text-lg font-bold text-white leading-tight">Fazenda+</h1>
                            <p className="text-[10px] text-gray-400 -mt-0.5">Gestão de Rebanho</p>
                        </div>
                    </div>

                    {/* Navegação Desktop */}
                    <nav className="hidden md:flex items-center space-x-1">
                        <NavButton view="dashboard" label="Painel" currentView={currentView} setCurrentView={setCurrentView}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                            </svg>
                        </NavButton>
                        <NavButton view="management" label="Manejo" currentView={currentView} setCurrentView={setCurrentView}>
                            <MapPinIcon className="h-4 w-4" />
                        </NavButton>
                        <NavButton view="batches" label="Lotes" currentView={currentView} setCurrentView={setCurrentView}>
                            <ScaleIcon className="h-4 w-4" />
                        </NavButton>
                        <NavButton view="calendar" label="Agenda" currentView={currentView} setCurrentView={setCurrentView}>
                            <CalendarDaysIcon className="h-4 w-4" />
                        </NavButton>
                        <NavButton view="tasks" label="Tarefas" currentView={currentView} setCurrentView={setCurrentView}>
                            <ClipboardDocumentCheckIcon className="h-4 w-4" />
                        </NavButton>
                        <NavButton view="reports" label="Relatórios" currentView={currentView} setCurrentView={setCurrentView}>
                            <DocumentChartBarIcon className="h-4 w-4" />
                        </NavButton>
                    </nav>

                    {/* Ações */}
                    <div className="flex items-center gap-1.5 md:gap-2">
                        {/* Mobile: Relatórios */}
                        <button
                            onClick={() => setCurrentView('reports')}
                            className={`md:hidden p-2 rounded-lg transition-all ${
                                currentView === 'reports'
                                    ? 'bg-brand-primary text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <DocumentChartBarIcon className="w-5 h-5" />
                        </button>

                        {/* Sync */}
                        {onForceSync && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={`p-2 rounded-lg transition-all ${
                                    isSyncing 
                                        ? 'text-brand-primary-light' 
                                        : 'text-gray-400 hover:text-white hover:bg-base-700'
                                }`}
                                title={`Sync: ${formatLastSync()}`}
                            >
                                <RefreshIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                            </button>
                        )}

                        {/* Adicionar Animal - Desktop */}
                        {onAddAnimalClick && (
                            <button
                                onClick={onAddAnimalClick}
                                className="hidden md:flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-light text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-md shadow-brand-primary/20"
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span>Novo Animal</span>
                            </button>
                        )}

                        {/* Separador */}
                        <div className="hidden md:block w-px h-8 bg-base-600 mx-1" />
                        
                        {/* Avatar e menu */}
                        <div className="flex items-center gap-2">
                            {/* Avatar */}
                            <div className="relative">
                                <img 
                                    className="h-8 w-8 rounded-full ring-2 ring-base-600" 
                                    src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=374151&color=fff&size=64`} 
                                    alt="Avatar" 
                                />
                                {/* Online indicator */}
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-base-800" />
                            </div>

                            {/* Info - Desktop & Mobile Role */}
                            <div className="max-w-[120px]">
                                <p className="hidden sm:block text-sm font-medium text-white truncate">{user.displayName}</p>
                                {onRoleClick ? (
                                    <button
                                        onClick={onRoleClick}
                                        className="text-xs text-gray-400 hover:text-brand-primary-light flex items-center gap-1"
                                    >
                                        <span>{roleInfo.icon}</span>
                                        <span>{roleInfo.label}</span>
                                    </button>
                                ) : (
                                    <p className="hidden sm:block text-xs text-gray-500">Sync: {formatLastSync()}</p>
                                )}
                            </div>

                            {/* Logout */}
                            <button 
                                onClick={handleLogout} 
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" 
                                title="Sair"
                            >
                                <LogoutIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
