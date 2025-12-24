import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import { Animal, AppUser } from './types';
import Spinner from './components/common/Spinner';
import MobileNavBar from './components/MobileNavBar';
import { firebaseServices } from './services/firebase';
import DashboardSettings from './components/DashboardSettings';
import RoleSelector from './components/RoleSelector';
import CapatazView from './components/CapatazView';
import QuickWeightModal from './components/QuickWeightModal';
import QuickMedicationModal from './components/QuickMedicationModal';
import AppRouter from './components/AppRouter';
import { FarmProvider, useFarmData } from './contexts/FarmContext';
import { AUTO_SYNC_INTERVAL_MS } from './constants/app';
import { useOfflineSyncManager } from './hooks/useOfflineSyncManager';
import { useAnimalActions } from './hooks/useAnimalActions';

// Modais globais (permanecem aqui)
const AnimalDetailModal = lazy(() => import('./components/AnimalDetailModal'));
const AddAnimalModal = lazy(() => import('./components/AddAnimalModal'));
const ScaleImportModal = lazy(() => import('./components/ScaleImportModal'));
const Chatbot = lazy(() => import('./components/Chatbot'));

interface AppProps {
    user: AppUser;
    firebaseReady: boolean;
}

const InnerApp = ({ user, firebaseReady }: AppProps) => {
    // Consumindo Contexto Global
    const { firestore, userProfile, dashboardConfig } = useFarmData();

    // 🔧 CUSTOM HOOKS
    useOfflineSyncManager();
    const {
        handleAddAnimal: performAddAnimal,
        handleUpdateAnimal,
        handleDeleteAnimal,
        handleQuickWeightSave,
        handleQuickMedicationSave,
        handleScaleImportComplete
    } = useAnimalActions(user.uid);

    // Destruturando dados do Firestore
    const {
        state,
        db: dbInstance,
        forceSync,
        syncDelta, // 🔧 OTIMIZAÇÃO: Sync delta para economia de leituras
        addOrUpdateCalendarEvent,
        deleteCalendarEvent,
        addTask,
        toggleTaskCompletion,
        deleteTask,
    } = firestore;

    // Destruturando Perfil de Usuário
    const { role, changeRole, canAccess, isCapataz, getUserProfile } = userProfile;

    // Destruturando Config do Dashboard
    const { config, toggleWidget, setWidgetSize, resetToDefault } = dashboardConfig;

    const [showRoleSelector, setShowRoleSelector] = useState(false);
    const [currentView, setCurrentView] = useState<'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management' | 'batches'>('dashboard');
    const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
    const [isAddAnimalModalOpen, setIsAddAnimalModalOpen] = useState(false);
    const [showDashboardSettings, setShowDashboardSettings] = useState(false);
    const [showScaleImportModal, setShowScaleImportModal] = useState(false);

    // Estados para ações rápidas (swipe)
    const [quickWeightAnimal, setQuickWeightAnimal] = useState<Animal | null>(null);
    const [quickMedicationAnimal, setQuickMedicationAnimal] = useState<Animal | null>(null);

    const selectedAnimal = useMemo(() => state.animals.find(a => a.id === selectedAnimalId) || null, [state.animals, selectedAnimalId]);

    const hasDatabase = Boolean(dbInstance);
    // storage vem do getter dinâmico
    const hasStorage = Boolean(firebaseServices.storage);
    const costlyActionsEnabled = firebaseReady && hasDatabase && hasStorage;

    const handleSelectAnimal = (animal: Animal) => {
        setSelectedAnimalId(animal.id);
    };

    const handleCloseModal = () => {
        setSelectedAnimalId(null);
    };

    const handleOpenAddAnimalModal = () => {
        setIsAddAnimalModalOpen(true);
    };

    // Wrapper para fechar o modal após adicionar
    const handleAddAnimalWrapper = async (animalData: Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>) => {
        await performAddAnimal(animalData);
        setIsAddAnimalModalOpen(false);
    };

    // 🔧 OTIMIZAÇÃO: Auto-sync com delta (economiza leituras do Firestore)
    // Com listeners em tempo real, este sync serve apenas como fallback de segurança
    useEffect(() => {
        if (!dbInstance) return;

        const intervalId = window.setInterval(async () => {
            if (navigator.onLine) {
                // Tenta sync delta primeiro (mais eficiente)
                const deltaResult = await syncDelta();
                if (deltaResult === false) {
                    // Se não tem lastSync, faz sync completo
                    console.log('🔄 [AUTO-SYNC] Executando sync completo como fallback...');
                    forceSync();
                }
            }
        }, AUTO_SYNC_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [forceSync, syncDelta, dbInstance]);

    const isAppLoading = state.loading.animals || state.loading.calendar || state.loading.tasks || state.loading.areas;

    if (isAppLoading) {
        return (
            <div className="min-h-screen bg-base-900 flex flex-col justify-center items-center text-white">
                <Spinner />
                <p className="mt-4">Carregando dados da fazenda...</p>
                <p className="mt-2 text-sm text-gray-400">
                    Carregando do cache local...
                </p>
            </div>
        );
    }

    // Se for Capataz, renderiza view restrita
    if (isCapataz) {
        const userProfileData = getUserProfile();
        if (userProfileData) {
            return (
                <>
                    <CapatazView
                        user={userProfileData}
                        tasks={state.tasks}
                        calendarEvents={state.calendarEvents}
                        onAddTask={addTask}
                        onToggleTask={toggleTaskCompletion}
                        onDeleteTask={deleteTask}
                        onAddCalendarEvent={addOrUpdateCalendarEvent}
                        onDeleteCalendarEvent={deleteCalendarEvent}
                    />
                    {/* Botão para trocar perfil */}
                    <button
                        onClick={() => setShowRoleSelector(true)}
                        className="fixed bottom-4 right-4 px-3 py-2 bg-base-700 text-gray-400 rounded-lg text-xs hover:bg-base-600 z-30"
                    >
                        👷 Trocar Perfil
                    </button>
                    <RoleSelector
                        currentRole={role}
                        onChangeRole={changeRole}
                        isOpen={showRoleSelector}
                        onClose={() => setShowRoleSelector(false)}
                    />
                </>
            );
        }
    }

    return (
        <div className="min-h-screen bg-base-900 font-sans pb-24 md:pb-0">
            <Header
                currentView={currentView}
                setCurrentView={setCurrentView}
                onAddAnimalClick={canAccess('canEditAnimals') ? handleOpenAddAnimalModal : undefined}
                user={user}
                onForceSync={hasDatabase ? forceSync : undefined}
                lastSync={state.lastSync}
                userRole={role}
                onRoleClick={() => setShowRoleSelector(true)}
            />

            <main className="p-4 md:p-8 max-w-7xl mx-auto">
                {!costlyActionsEnabled && (
                    <div className="mb-4 rounded-lg border border-yellow-700 bg-yellow-900/30 p-3 text-yellow-200 text-sm">
                        <p className="font-semibold text-yellow-100">Configuração necessária</p>
                        <p>
                            Para usar exportação e upload, confirme o <code className="bg-base-800 px-1 rounded">window.__FIREBASE_CONFIG__</code> no
                            <code className="bg-base-800 px-1 rounded ml-1">index.html</code> e garanta que Firestore e Storage estejam ativos.
                        </p>
                    </div>
                )}

                <AppRouter
                    currentView={currentView}
                    costlyActionsEnabled={costlyActionsEnabled}
                    setShowDashboardSettings={setShowDashboardSettings}
                    onSelectAnimal={handleSelectAnimal}
                    onQuickWeight={(animal) => setQuickWeightAnimal(animal)}
                    onQuickMedication={(animal) => setQuickMedicationAnimal(animal)}
                    onLongPress={(animal) => setSelectedAnimalId(animal.id)}
                    setShowScaleImportModal={setShowScaleImportModal}
                />
            </main>

            <Suspense fallback={null}>
                <AnimalDetailModal
                    animal={selectedAnimal}
                    isOpen={!!selectedAnimal}
                    onClose={handleCloseModal}
                    onUpdateAnimal={handleUpdateAnimal}
                    onDeleteAnimal={handleDeleteAnimal}
                    animals={state.animals}
                    user={user}
                    storageReady={costlyActionsEnabled}
                />

                <AddAnimalModal
                    isOpen={isAddAnimalModalOpen}
                    onClose={() => setIsAddAnimalModalOpen(false)}
                    onAddAnimal={handleAddAnimalWrapper}
                    animals={state.animals}
                />

                <ScaleImportModal
                    isOpen={showScaleImportModal}
                    onClose={() => setShowScaleImportModal(false)}
                    animals={state.animals}
                    onImportComplete={handleScaleImportComplete}
                />

                <Chatbot animals={state.animals} />
            </Suspense>

            {/* Modais de ação rápida (swipe) */}
            <QuickWeightModal
                isOpen={!!quickWeightAnimal}
                onClose={() => setQuickWeightAnimal(null)}
                animal={quickWeightAnimal}
                onSave={handleQuickWeightSave}
            />

            <QuickMedicationModal
                isOpen={!!quickMedicationAnimal}
                onClose={() => setQuickMedicationAnimal(null)}
                animal={quickMedicationAnimal}
                onSave={handleQuickMedicationSave}
            />

            <MobileNavBar
                currentView={currentView}
                setCurrentView={setCurrentView}
                onAddAnimalClick={canAccess('canEditAnimals') ? handleOpenAddAnimalModal : undefined}
            />

            {showDashboardSettings && (
                <DashboardSettings
                    widgets={config.widgets}
                    toggleWidget={toggleWidget}
                    setWidgetSize={setWidgetSize}
                    resetToDefault={resetToDefault}
                    onClose={() => setShowDashboardSettings(false)}
                />
            )}

            <RoleSelector
                currentRole={role}
                onChangeRole={changeRole}
                isOpen={showRoleSelector}
                onClose={() => setShowRoleSelector(false)}
            />
        </div>
    );
};

const App = (props: AppProps) => (
    <FarmProvider user={props.user}>
        <InnerApp {...props} />
    </FarmProvider>
);

export default App;