import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import { offlineQueue } from './utils/offlineSync';
import { Animal, AppUser, WeighingType, WeightEntry, MedicationAdministration } from './types';
import Spinner from './components/common/Spinner';
import MobileNavBar from './components/MobileNavBar';
import { storage } from './services/firebase';
import DashboardSettings from './components/DashboardSettings';
import RoleSelector from './components/RoleSelector';
import CapatazView from './components/CapatazView';
import QuickWeightModal from './components/QuickWeightModal';
import QuickMedicationModal from './components/QuickMedicationModal';
import AppRouter from './components/AppRouter';
import { FarmProvider, useFarmData } from './contexts/FarmContext';

// Modais globais (permanecem aqui)
const AnimalDetailModal = lazy(() => import('./components/AnimalDetailModal'));
const AddAnimalModal = lazy(() => import('./components/AddAnimalModal'));
const ScaleImportModal = lazy(() => import('./components/ScaleImportModal'));
const Chatbot = lazy(() => import('./components/Chatbot'));

interface AppProps {
    user: AppUser;
    firebaseReady: boolean;
}

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const InnerApp = ({ user, firebaseReady }: AppProps) => {
    // Consumindo Contexto Global
    const { firestore, userProfile, dashboardConfig } = useFarmData();

    // Destruturando dados do Firestore
    const {
        state,
        db: dbInstance,
        forceSync,
        addAnimal,
        updateAnimal,
        deleteAnimal,
        archiveAnimal,
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
    const [focusNFePanel, setFocusNFePanel] = useState(false);

    // Estados para ações rápidas (swipe)
    const [quickWeightAnimal, setQuickWeightAnimal] = useState<Animal | null>(null);
    const [quickMedicationAnimal, setQuickMedicationAnimal] = useState<Animal | null>(null);

    const selectedAnimal = useMemo(() => state.animals.find(a => a.id === selectedAnimalId) || null, [state.animals, selectedAnimalId]);

    const hasDatabase = Boolean(dbInstance);
    // storage vem do import estático, mas verificamos se está disponível
    const hasStorage = Boolean(storage);
    const costlyActionsEnabled = firebaseReady && hasDatabase && hasStorage;

    useEffect(() => {
        if (!dbInstance) return;

        const handleSync = async () => {
            console.log('🔄 Internet voltou! Sincronizando dados offline...');
            await offlineQueue.processQueue(dbInstance);
            alert('✅ Dados sincronizados com sucesso!');
        };

        window.addEventListener('sync-offline-data', handleSync);
        return () => window.removeEventListener('sync-offline-data', handleSync);
    }, [firestore, dbInstance]);

    const handleSelectAnimal = (animal: Animal) => {
        setSelectedAnimalId(animal.id);
    };

    const handleDeleteAnimal = async (animalId: string) => {
        try {
            await deleteAnimal(animalId);
        } catch (error) {
            alert(`Ocorreu um erro ao excluir o animal.`);
            console.error("Deletion failed:", error);
        }
    };

    const handleArchiveAnimal = async (animalId: string) => {
        try {
            await archiveAnimal(animalId);
            handleCloseModal();
            alert('Animal arquivado com sucesso!');
        } catch (error) {
            alert(`Erro ao arquivar animal.`);
            console.error("Archive failed:", error);
        }
    };

    const handleCloseModal = () => {
        setSelectedAnimalId(null);
    };

    const handleAddAnimal = async (animalData: Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>) => {
        try {
            if (navigator.onLine) {
                await addAnimal(animalData);
                setIsAddAnimalModalOpen(false);
            } else {
                offlineQueue.add({
                    type: 'create',
                    collection: 'animals',
                    data: {
                        ...animalData,
                        userId: user.uid
                    }
                });
                setIsAddAnimalModalOpen(false);
                alert('📱 Animal salvo localmente! Será sincronizado quando a internet voltar.');
            }
        } catch (error) {
            console.error('Erro ao adicionar animal:', error);
            alert('❌ Erro ao adicionar animal');
        }
    };

    const handleUpdateAnimal = async (animalId: string, updatedData: Partial<Animal>) => {
        try {
            if (navigator.onLine) {
                await updateAnimal(animalId, updatedData);
            } else {
                offlineQueue.add({
                    type: 'update',
                    collection: 'animals',
                    data: { id: animalId, ...updatedData }
                });
                alert('📱 Alterações salvas localmente!');
            }
        } catch (error) {
            console.error('Erro ao atualizar animal:', error);
            alert('❌ Erro ao atualizar animal');
        }
    };

    const handleOpenAddAnimalModal = () => {
        setIsAddAnimalModalOpen(true);
    };

    // Handler para salvar peso rápido (swipe direita)
    const handleQuickWeightSave = async (animalId: string, weight: number, type: WeighingType) => {
        try {
            const animal = state.animals.find(a => a.id === animalId);
            if (!animal) return;

            const newEntry: WeightEntry = {
                id: `quick-${Date.now()}`,
                date: new Date(),
                weightKg: weight,
                type: type === WeighingType.None ? undefined : type,
            };

            const historicoPesagens = [...(animal.historicoPesagens || []), newEntry]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            await updateAnimal(animalId, {
                historicoPesagens,
                pesoKg: weight,
            });
        } catch (error) {
            console.error('Erro ao salvar peso:', error);
            alert('❌ Erro ao salvar peso');
        }
    };

    // Handler para salvar medicação rápida (swipe esquerda)
    const handleQuickMedicationSave = async (animalId: string, medication: Omit<MedicationAdministration, 'id'>) => {
        try {
            const animal = state.animals.find(a => a.id === animalId);
            if (!animal) return;

            const newMedication: MedicationAdministration = {
                id: `med-${Date.now()}`,
                ...medication,
            };

            const historicoSanitario = [...(animal.historicoSanitario || []), newMedication];

            await updateAnimal(animalId, { historicoSanitario });
        } catch (error) {
            console.error('Erro ao salvar medicação:', error);
            alert('❌ Erro ao salvar medicação');
        }
    };

    const handleScaleImportComplete = async (
        weightsMap: Map<string, { weight: number; date: Date; type: WeighingType }>
    ) => {
        try {
            const updates: Promise<void>[] = [];

            weightsMap.forEach((data, animalId) => {
                const animal = state.animals.find(a => a.id === animalId);
                if (!animal) return;

                const newEntry: WeightEntry = {
                    id: `scale-${Date.now()}-${animalId}`,
                    date: data.date,
                    weightKg: data.weight,
                    type: data.type === WeighingType.None ? undefined : data.type,
                };

                const historicoPesagens = [...(animal.historicoPesagens || []), newEntry]
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                updates.push(updateAnimal(animalId, {
                    historicoPesagens,
                    pesoKg: data.weight,
                }));
            });

            await Promise.all(updates);
            alert('Pesagens importadas da balança com sucesso!');
        } catch (error) {
            console.error('Erro ao importar pesagens:', error);
            alert('Não foi possível concluir a importação da balança.');
        }
    };

    useEffect(() => {
        if (!dbInstance) return;

        const intervalId = window.setInterval(() => {
            if (navigator.onLine) {
                forceSync();
            }
        }, AUTO_SYNC_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [forceSync, dbInstance]);

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
                    focusNFePanel={focusNFePanel}
                    setFocusNFePanel={setFocusNFePanel}
                />
            </main>

            <Suspense fallback={null}>
                <AnimalDetailModal
                    animal={selectedAnimal}
                    isOpen={!!selectedAnimal}
                    onClose={handleCloseModal}
                    onUpdateAnimal={handleUpdateAnimal}
                    onDeleteAnimal={handleDeleteAnimal}
                    onArchiveAnimal={handleArchiveAnimal}
                    animals={state.animals}
                    user={user}
                    storageReady={costlyActionsEnabled}
                />

                <AddAnimalModal
                    isOpen={isAddAnimalModalOpen}
                    onClose={() => setIsAddAnimalModalOpen(false)}
                    onAddAnimal={handleAddAnimal}
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