import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import { offlineQueue } from './utils/offlineSync';
import { useFirestoreOptimized } from './hooks/useFirestoreOptimized';
import { Animal, AppUser } from './types';
import Spinner from './components/common/Spinner';
import MobileNavBar from './components/MobileNavBar';
import { useAdvancedFilters } from './hooks/useAdvancedFilters';
import { useDashboardConfig } from './hooks/useDashboardConfig';
import { db, storage } from './services/firebase';

// OTIMIZAÇÃO: Lazy load de todos componentes pesados
const Dashboard = lazy(() => import('./components/Dashboard'));
const AnimalDetailModal = lazy(() => import('./components/AnimalDetailModal'));
const AddAnimalModal = lazy(() => import('./components/AddAnimalModal'));
const FilterBar = lazy(() => import('./components/FilterBar'));
const Chatbot = lazy(() => import('./components/Chatbot'));
const StatsDashboard = lazy(() => import('./components/StatsDashboard'));
const TasksView = lazy(() => import('./components/TasksView'));
const ExportButtons = lazy(() => import('./components/ExportButtons'));
const DashboardSettings = lazy(() => import('./components/DashboardSettings'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const ManagementView = lazy(() => import('./components/ManagementView'));

interface AppProps {
    user: AppUser;
    firebaseReady: boolean;
}

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const App = ({ user, firebaseReady }: AppProps) => {
    const {
        state,
        db,
        forceSync,
        addAnimal,
        updateAnimal,
        deleteAnimal,
        addOrUpdateCalendarEvent,
        deleteCalendarEvent,
        addTask,
        toggleTaskCompletion,
        deleteTask,
        addOrUpdateManagementArea,
        deleteManagementArea,
        assignAnimalsToArea,
    } = useFirestoreOptimized(user);

    const [currentView, setCurrentView] = useState<'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management'>('dashboard');
    const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
    const [isAddAnimalModalOpen, setIsAddAnimalModalOpen] = useState(false);
    const [showDashboardSettings, setShowDashboardSettings] = useState(false);

    const selectedAnimal = useMemo(() => state.animals.find(a => a.id === selectedAnimalId) || null, [state.animals, selectedAnimalId]);

    const {
        filters,
        filteredAnimals,
        stats,
        setSearchTerm,
        setSelectedMedication,
        setSelectedReason,
        setSelectedStatus,
        setSelectedSexo,
        setSelectedRaca,
        setSelectedAreaId,
        setWeightRange,
        setAgeRange,
        setSearchFields,
        setSortConfig,
        clearAllFilters,
        activeFiltersCount,
        allMedications,
        allReasons,
    } = useAdvancedFilters({
        animals: state.animals,
        areas: state.managementAreas
    });

    const {
        config,
        enabledWidgets,
        toggleWidget,
        setWidgetSize,
        resetToDefault
    } = useDashboardConfig();

    const hasDatabase = Boolean(db);
    const hasStorage = Boolean(storage);
    const costlyActionsEnabled = firebaseReady && hasDatabase && hasStorage;

    const listFallback = (
        <div className="flex justify-center p-8">
            <Spinner size="lg" />
        </div>
    );

    const modalFallback = (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
            <Spinner size="lg" />
        </div>
    );

    useEffect(() => {
        if (!db) return;

        const handleSync = async () => {
            console.log('🔄 Internet voltou! Sincronizando dados offline...');
            await offlineQueue.processQueue(db);
            // OTIMIZAÇÃO: Não força sync completo - cache local já está atualizado
            // As operações offline já foram aplicadas no estado local
            alert('✅ Dados sincronizados com sucesso!');
        };

        window.addEventListener('sync-offline-data', handleSync);
        return () => window.removeEventListener('sync-offline-data', handleSync);
    }, [db]);

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

    useEffect(() => {
        if (!db) return;

        const intervalId = window.setInterval(() => {
            if (navigator.onLine) {
                forceSync();
            }
        }, AUTO_SYNC_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [forceSync, db]);

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

    return (
        <div className="min-h-screen bg-base-900 font-sans pb-24 md:pb-0">
            <Header
                currentView={currentView}
                setCurrentView={setCurrentView}
                onAddAnimalClick={handleOpenAddAnimalModal}
                user={user}
                onForceSync={hasDatabase ? forceSync : undefined}
                lastSync={state.lastSync}
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

                {currentView === 'dashboard' && (
                    <Suspense fallback={listFallback}>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 md:mb-6 gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold text-white">Painel do Rebanho</h1>
                            <div className="hidden sm:flex">
                                {costlyActionsEnabled ? (
                                    <ExportButtons
                                        animals={filteredAnimals}
                                        stats={stats}
                                        areas={state.managementAreas}
                                    />
                                ) : (
                                    <div className="text-xs text-yellow-300 border border-yellow-700 rounded px-3 py-2 bg-yellow-900/20">
                                        Configure o Firebase para habilitar exportação.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-white">Estatísticas</h2>
                            <button
                                onClick={() => setShowDashboardSettings(true)}
                                className="text-sm text-brand-primary-light hover:text-brand-primary"
                            >
                                ⚙️ Configurar
                            </button>
                        </div>
                        <StatsDashboard
                            stats={stats}
                            enabledWidgets={enabledWidgets}
                            areas={state.managementAreas}
                            compactMode={config.compactMode}
                            calendarEvents={state.calendarEvents}
                            tasks={state.tasks}
                        />

                        <FilterBar
                            searchTerm={filters.searchTerm}
                            setSearchTerm={setSearchTerm}
                            searchFields={filters.searchFields}
                            setSearchFields={setSearchFields}
                            selectedMedication={filters.selectedMedication}
                            setSelectedMedication={setSelectedMedication}
                            selectedReason={filters.selectedReason}
                            setSelectedReason={setSelectedReason}
                            allMedications={allMedications}
                            allReasons={allReasons}
                            selectedStatus={filters.selectedStatus}
                            setSelectedStatus={setSelectedStatus}
                            selectedSexo={filters.selectedSexo}
                            setSelectedSexo={setSelectedSexo}
                            selectedRaca={filters.selectedRaca}
                            setSelectedRaca={setSelectedRaca}
                            selectedAreaId={filters.selectedAreaId}
                            setSelectedAreaId={setSelectedAreaId}
                            areas={state.managementAreas}
                            weightRange={filters.weightRange}
                            setWeightRange={setWeightRange}
                            ageRange={filters.ageRange}
                            setAgeRange={setAgeRange}
                            sortConfig={filters.sortConfig}
                            setSortConfig={setSortConfig}
                            onClear={clearAllFilters}
                            activeFiltersCount={activeFiltersCount}
                        />

                        <Dashboard animals={filteredAnimals} onSelectAnimal={handleSelectAnimal} />

                        <div className="sm:hidden mt-6">
                            {costlyActionsEnabled ? (
                                <ExportButtons
                                    animals={filteredAnimals}
                                    stats={stats}
                                    areas={state.managementAreas}
                                />
                            ) : (
                                <div className="text-xs text-yellow-300 border border-yellow-700 rounded px-3 py-2 bg-yellow-900/20">
                                    Configure o Firebase para habilitar exportação.
                                </div>
                            )}
                        </div>
                    </Suspense>
                )}

                {currentView === 'reports' && (
                    <Suspense fallback={listFallback}>
                        <ReportsView animals={state.animals} />
                    </Suspense>
                )}

                {currentView === 'calendar' && (
                    <Suspense fallback={listFallback}>
                        <CalendarView
                            events={state.calendarEvents}
                            onSave={addOrUpdateCalendarEvent}
                            onDelete={deleteCalendarEvent}
                        />
                    </Suspense>
                )}

                {currentView === 'tasks' && (
                    <Suspense fallback={listFallback}>
                        <TasksView
                            tasks={state.tasks}
                            onAddTask={addTask}
                            onToggleTaskCompletion={toggleTaskCompletion}
                            onDeleteTask={deleteTask}
                        />
                    </Suspense>
                )}

                {currentView === 'management' && (
                    <Suspense fallback={listFallback}>
                        <ManagementView
                            animals={state.animals}
                            areas={state.managementAreas}
                            onSaveArea={addOrUpdateManagementArea}
                            onDeleteArea={deleteManagementArea}
                            onAssignAnimalsToArea={assignAnimalsToArea}
                        />
                    </Suspense>
                )}
            </main>

            <Suspense fallback={modalFallback}>
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
            </Suspense>

            <Suspense fallback={modalFallback}>
                <AddAnimalModal
                    isOpen={isAddAnimalModalOpen}
                    onClose={() => setIsAddAnimalModalOpen(false)}
                    onAddAnimal={handleAddAnimal}
                    animals={state.animals}
                />
            </Suspense>

            <Suspense fallback={null}>
                <Chatbot animals={state.animals} />
            </Suspense>

            <MobileNavBar
                currentView={currentView}
                setCurrentView={setCurrentView}
                onAddAnimalClick={handleOpenAddAnimalModal}
            />

            {showDashboardSettings && (
                <Suspense fallback={modalFallback}>
                    <DashboardSettings
                        widgets={config.widgets}
                        toggleWidget={toggleWidget}
                        setWidgetSize={setWidgetSize}
                        resetToDefault={resetToDefault}
                        onClose={() => setShowDashboardSettings(false)}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default App;
