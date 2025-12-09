import React, { Suspense, lazy } from 'react';
import Spinner from './common/Spinner';
import { AppUser, Animal, FilteredStats, CalendarEvent, Task, ManagementArea, ManagementBatch, DashboardWidget, DashboardConfig, UserRole, AdvancedFilters } from '../types';
import { ChartDataPoint, MonthlyMedicationUsage, TopTreatedAnimal } from '../types'; // Adjust if needed

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
const DashboardSettings = lazy(() => import('./DashboardSettings')); // Maybe this stays in App or goes to Dashboard?

interface AppRouterProps {
  currentView: 'dashboard' | 'reports' | 'calendar' | 'tasks' | 'management' | 'batches';
  user: AppUser;
  costlyActionsEnabled: boolean;
  
  // Data
  animals: Animal[];
  filteredAnimals: Animal[];
  stats: FilteredStats;
  calendarEvents: CalendarEvent[];
  tasks: Task[];
  areas: ManagementArea[];
  batches: ManagementBatch[];
  
  // Filter States & Setters
  filters: AdvancedFilters; // You might want to pass the whole object or individual props. Let's pass helpers.
  setSearchTerm: (term: string) => void;
  setSearchFields: (fields: any[]) => void;
  setSelectedMedication: (med: string) => void;
  setSelectedReason: (reason: string) => void;
  setSelectedStatus: (status: string) => void;
  setSelectedSexo: (sex: string) => void;
  setSelectedRaca: (race: string) => void;
  setSelectedAreaId: (id: string) => void;
  setWeightRange: (range: { min: number | null; max: number | null }) => void;
  setAgeRange: (range: { minMonths: number | null; maxMonths: number | null }) => void;
  setSortConfig: (config: any) => void;
  clearAllFilters: () => void;
  activeFiltersCount: number;
  allMedications: string[];
  allReasons: string[];

  // Dashboard Config
  config: DashboardConfig;
  enabledWidgets: DashboardWidget[];
  toggleWidget: (id: string) => void;
  setWidgetSize: (id: string, size: 'small' | 'medium' | 'large') => void;
  resetToDefault: () => void;
  setShowDashboardSettings: (show: boolean) => void;

  // Handlers
  onSelectAnimal: (animal: Animal) => void;
  onQuickWeight: (animal: Animal) => void;
  onQuickMedication: (animal: Animal) => void;
  onLongPress: (animal: Animal) => void;
  
  // Data Mutation Handlers
  addTask: (task: any) => Promise<void>;
  toggleTaskCompletion: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  
  addOrUpdateCalendarEvent: (event: any) => Promise<void>;
  deleteCalendarEvent: (eventId: string) => Promise<void>;
  
  addOrUpdateManagementArea: (area: any) => Promise<void>;
  deleteManagementArea: (areaId: string) => Promise<void>;
  assignAnimalsToArea: (areaId: string, animalIds: string[]) => Promise<void>; // Check signature

  createBatch: (batch: any) => void;
  updateBatch: (id: string, data: any) => void;
  deleteBatch: (id: string) => void;
  completeBatch: (id: string) => void;
  
  setShowScaleImportModal: (show: boolean) => void;
  
  // Reports specific
  focusNFePanel: boolean;
  setFocusNFePanel: (focus: boolean) => void;
}

const AppRouter: React.FC<AppRouterProps> = ({
  currentView,
  user,
  costlyActionsEnabled,
  animals,
  filteredAnimals,
  stats,
  calendarEvents,
  tasks,
  areas,
  batches,
  filters,
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
  config,
  enabledWidgets,
  setShowDashboardSettings,
  onSelectAnimal,
  onQuickWeight,
  onQuickMedication,
  onLongPress,
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
  setShowScaleImportModal,
  focusNFePanel,
  setFocusNFePanel,
}) => {
  
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
                        areas={areas}
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
            areas={areas}
            compactMode={config.compactMode}
            calendarEvents={calendarEvents}
            tasks={tasks}
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
            areas={areas}
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
                            areas={areas}
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
                animals={animals}
                focusNFe={focusNFePanel}
                onNFeHandled={() => setFocusNFePanel(false)}
            />
        </Suspense>
    );
  }

  if (currentView === 'calendar') {
    return (
        <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
            <CalendarView 
                events={calendarEvents} 
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
                tasks={tasks} 
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
                animals={animals}
                areas={areas}
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
                batches={batches}
                animals={animals}
                onCreateBatch={createBatch}
                onUpdateBatch={updateBatch}
                onDeleteBatch={deleteBatch}
                onCompleteBatch={completeBatch}
            />
        </Suspense>
    );
  }

  return null;
};

export default AppRouter;
