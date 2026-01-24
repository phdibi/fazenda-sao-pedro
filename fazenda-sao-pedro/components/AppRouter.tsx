import React, { Suspense, lazy } from 'react';
import Spinner from './common/Spinner';
import { useFarmData } from '../contexts/FarmContext';
import { Animal } from '../types';

// Lazy components
const Dashboard = lazy(() => import('./Dashboard'));
const StatsDashboard = lazy(() => import('./StatsDashboard'));
const FilterBar = lazy(() => import('./FilterBar'));
const TasksView = lazy(() => import('./TasksView'));
const ExportButtons = lazy(() => import('./ExportButtons'));
const CalendarView = lazy(() => import('./CalendarView'));
const ReportsView = lazy(() => import('./ReportsView'));
const ManagementView = lazy(() => import('./ManagementView'));
const BatchManagement = lazy(() => import('./BatchManagement'));
// 🔧 NOVO: Estação de Monta
const BreedingSeasonManager = lazy(() => import('./BreedingSeasonManager'));

interface AppRouterProps {
    currentView: 'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management' | 'batches' | 'breeding';
    costlyActionsEnabled: boolean;

    // UI State Handlers (Managed in MainLayout/App)
    setShowDashboardSettings: (show: boolean) => void;
    onSelectAnimal: (animal: Animal) => void;
    onQuickWeight: (animal: Animal) => void;
    onQuickMedication: (animal: Animal) => void;
    onLongPress: (animal: Animal) => void;
    setShowScaleImportModal: (show: boolean) => void;

}

const AppRouter: React.FC<AppRouterProps> = ({
    currentView,
    costlyActionsEnabled,
    setShowDashboardSettings,
    onSelectAnimal,
    onQuickWeight,
    onQuickMedication,
    onLongPress,
    setShowScaleImportModal,
}) => {
    const { firestore, filters: advancedFilters, dashboardConfig } = useFarmData();

    const {
        state,
        addTask,
        toggleTaskCompletion,
        deleteTask,
        addOrUpdateCalendarEvent,
        deleteCalendarEvent,
        addOrUpdateManagementArea,
        deleteManagementArea,
        assignAnimalsToArea,
        createBatch,
        updateBatch,
        deleteBatch,
        completeBatch,
        // Breeding Seasons
        createBreedingSeason,
        updateBreedingSeason,
        deleteBreedingSeason,
        addCoverageToSeason,
        updatePregnancyDiagnosis,
        // Animal CRUD
        updateAnimal,
    } = firestore;

    const {
        filters,
        filteredAnimals,
        stats,
        setSearchTerm,
        setSearchFields,
        setSelectedMedication,
        setSelectedReason,
        setSelectedStatus,
        setSelectedSexo,
        setSelectedRaca,
        setSelectedAreaId,
        setWeightRange,
        setAgeRange,
        setSortConfig,
        clearAllFilters,
        activeFiltersCount,
        allMedications,
        allReasons,
    } = advancedFilters;

    const {
        config,
        enabledWidgets,
        toggleWidget
    } = dashboardConfig;


    if (currentView === 'dashboard') {
        return (
            <Suspense fallback={<div className="flex justify-center p-8"><Spinner /></div>}>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 md:mb-6 gap-3">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Painel do Rebanho</h1>
                    <div className="hidden sm:flex items-center gap-3">
                        <button
                            onClick={() => setShowScaleImportModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-md bg-base-700 hover:bg-base-600 text-sm text-white border border-base-600"
                        >
                            <span role="img" aria-label="balança">⚖️</span>
                            Importar Balança
                        </button>
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
                    animals={filteredAnimals}
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

                <Dashboard
                    animals={filteredAnimals}
                    onSelectAnimal={onSelectAnimal}
                    onQuickWeight={onQuickWeight}
                    onQuickMedication={onQuickMedication}
                    onLongPress={onLongPress}
                />

                <div className="sm:hidden mt-6">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setShowScaleImportModal(true)}
                            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-base-700 hover:bg-base-600 text-xs font-semibold text-white border border-base-600"
                        >
                            <span role="img" aria-label="balança">⚖️</span>
                            <span className="leading-tight text-left">Importar
                                <br />Balança
                            </span>
                        </button>
                        {costlyActionsEnabled ? (
                            <div className="col-span-2">
                                <ExportButtons
                                    animals={filteredAnimals}
                                    stats={stats}
                                    areas={state.managementAreas}
                                    variant="compact"
                                />
                            </div>
                        ) : (
                            <div className="col-span-2 text-xs text-yellow-300 border border-yellow-700 rounded px-3 py-2 bg-yellow-900/20 flex items-center justify-center text-center">
                                Configure o Firebase para habilitar exportação.
                            </div>
                        )}
                    </div>
                </div>
            </Suspense>
        );
    }

    if (currentView === 'reports') {
        return (
            <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                <ReportsView
                    animals={state.animals}
                    onUpdateAnimal={updateAnimal}
                />
            </Suspense>
        );
    }

    if (currentView === 'calendar') {
        return (
            <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                <CalendarView
                    events={state.calendarEvents}
                    onSave={addOrUpdateCalendarEvent}
                    onDelete={deleteCalendarEvent}
                />
            </Suspense>
        );
    }

    if (currentView === 'tasks') {
        return (
            <Suspense fallback={<div className="flex justify-center p-8"><Spinner /></div>}>
                <TasksView
                    tasks={state.tasks}
                    onAddTask={addTask}
                    onToggleTask={toggleTaskCompletion}
                    onDeleteTask={deleteTask}
                />
            </Suspense>
        );
    }

    if (currentView === 'management') {
        return (
            <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                <ManagementView
                    animals={state.animals}
                    areas={state.managementAreas}
                    onSaveArea={addOrUpdateManagementArea}
                    onDeleteArea={deleteManagementArea}
                    onAssignAnimals={assignAnimalsToArea}
                />
            </Suspense>
        );
    }

    if (currentView === 'batches') {
        return (
            <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                <BatchManagement
                    batches={state.batches}
                    animals={state.animals}
                    onCreateBatch={createBatch}
                    onUpdateBatch={updateBatch}
                    onDeleteBatch={deleteBatch}
                    onCompleteBatch={completeBatch}
                />
            </Suspense>
        );
    }

    if (currentView === 'breeding') {
        return (
            <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                <BreedingSeasonManager
                    animals={state.animals}
                    seasons={state.breedingSeasons}
                    onCreateSeason={createBreedingSeason}
                    onUpdateSeason={updateBreedingSeason}
                    onDeleteSeason={deleteBreedingSeason}
                    onAddCoverage={addCoverageToSeason}
                    onUpdateDiagnosis={updatePregnancyDiagnosis}
                />
            </Suspense>
        );
    }

    return null;
};

export default AppRouter;
