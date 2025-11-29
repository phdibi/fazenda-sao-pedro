import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import { offlineQueue } from './utils/offlineSync';
import Dashboard from './components/Dashboard';
import AnimalDetailModal from './components/AnimalDetailModal';
import AddAnimalModal from './components/AddAnimalModal';
import { useFirestoreOptimized } from './hooks/useFirestoreOptimized';
import { Animal, AnimalStatus, AppUser, Task } from './types';
import FilterBar from './components/FilterBar';
import Chatbot from './components/Chatbot';
import StatsDashboard from './components/StatsDashboard';
import TasksView from './components/TasksView';
import AgendaPreview from './components/AgendaPreview';
import TasksPreview from './components/TasksPreview';
import { exportToCSV } from './utils/fileUtils';
import { ArrowDownTrayIcon } from './components/common/Icons';
import Spinner from './components/common/Spinner';
import MobileNavBar from './components/MobileNavBar';
import { debounce } from './utils/helpers';

// Lazy load das views pesadas
const CalendarView = lazy(() => import('./components/CalendarView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const ManagementView = lazy(() => import('./components/ManagementView'));

interface AppProps {
    user: AppUser;
}

const App = ({ user }: AppProps) => {
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

    const selectedAnimal = useMemo(() => state.animals.find(a => a.id === selectedAnimalId) || null, [state.animals, selectedAnimalId]);

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const debouncedSetSearch = useMemo(
        () => debounce((value: string) => setDebouncedSearch(value), 300),
        []
    );

    useEffect(() => {
        debouncedSetSearch(searchTerm);
    }, [searchTerm, debouncedSetSearch]);

    // Sincronização quando volta online
    useEffect(() => {
        const handleSync = async () => {
            if (db) {
                console.log('🔄 Internet voltou! Sincronizando dados offline...');
                await offlineQueue.processQueue(db);
                localStorage.removeItem('animals');
                await forceSync();
                alert('✅ Dados sincronizados com sucesso!');
            }
        };

        window.addEventListener('sync-offline-data', handleSync);
        return () => window.removeEventListener('sync-offline-data', handleSync);
    }, [db, forceSync]);

    const [selectedMedication, setSelectedMedication] = useState('');
    const [selectedReason, setSelectedReason] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedSexo, setSelectedSexo] = useState(''); // NOVO: Estado para filtro de sexo

    const allMedications = useMemo(() => {
        const meds = new Set<string>();
        state.animals.forEach(animal => {
            animal.historicoSanitario.forEach(med => meds.add(med.medicamento));
        });
        return Array.from(meds).sort();
    }, [state.animals]);

    const allReasons = useMemo(() => {
        const reasons = new Set<string>();
        state.animals.forEach(animal => {
            animal.historicoSanitario.forEach(med => reasons.add(med.motivo));
        });
        return Array.from(reasons).sort();
    }, [state.animals]);

    const filteredAnimals = useMemo(() => {
        return state.animals.filter(animal => {
            const matchesSearch = debouncedSearch === '' ||
                animal.brinco.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                animal.nome?.toLowerCase().includes(debouncedSearch.toLowerCase());

            const matchesMedication = selectedMedication === '' ||
                animal.historicoSanitario.some(med => med.medicamento === selectedMedication);

            const matchesReason = selectedReason === '' ||
                animal.historicoSanitario.some(med => med.motivo === selectedReason);

            const matchesStatus = selectedStatus === '' || animal.status === selectedStatus;

            // NOVO: Filtro de sexo
            const matchesSexo = selectedSexo === '' || animal.sexo === selectedSexo;

            return matchesSearch && matchesMedication && matchesReason && matchesStatus && matchesSexo;
        })
        .sort((a, b) => a.brinco.localeCompare(b.brinco));
    }, [state.animals, debouncedSearch, selectedMedication, selectedReason, selectedStatus, selectedSexo]);

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedMedication('');
        setSelectedReason('');
        setSelectedStatus('');
        setSelectedSexo(''); // NOVO: Limpa filtro de sexo
    };

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

    const handleExportCSV = () => {
        if (filteredAnimals.length === 0) {
            alert("Nenhum animal para exportar com os filtros atuais.");
            return;
        }
        const dataToExport = filteredAnimals.map(animal => ({
            brinco: animal.brinco,
            nome: animal.nome || '',
            raca: animal.raca,
            sexo: animal.sexo,
            dataNascimento: new Date(animal.dataNascimento).toLocaleDateString('pt-BR'),
            pesoKg: animal.pesoKg,
            status: animal.status,
            paiNome: animal.paiNome || '',
            maeNome: animal.maeNome || '',
            numMedicacoes: animal.historicoSanitario.length,
            numPesagens: animal.historicoPesagens.length,
            numPrenhez: animal.historicoPrenhez?.length || 0,
            numAbortos: animal.historicoAborto?.length || 0,
            numProgenie: animal.historicoProgenie?.length || 0,
        }));
        const headers = {
            brinco: 'Brinco',
            nome: 'Nome',
            raca: 'Raça',
            sexo: 'Sexo',
            dataNascimento: 'Data de Nascimento',
            pesoKg: 'Peso Atual (kg)',
            status: 'Status',
            paiNome: 'Pai',
            maeNome: 'Mãe',
            numMedicacoes: 'Nº Medicações',
            numPesagens: 'Nº Pesagens',
            numPrenhez: 'Nº Prenhez',
            numAbortos: 'Nº Abortos',
            numProgenie: 'Nº Crias'
        };
        const timestamp = new Date().toISOString().slice(0, 10);
        exportToCSV(dataToExport, headers, `relatorio_rebanho_${timestamp}.csv`);
    };

    // Handler para abrir modal de adicionar animal
    const handleOpenAddAnimalModal = () => {
        setIsAddAnimalModalOpen(true);
    };

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
                onForceSync={forceSync}
                lastSync={state.lastSync}
            />

            <main className="p-4 md:p-8 max-w-7xl mx-auto">
                {currentView === 'dashboard' && (
                    <>
                        {/* Header do painel - mais limpo no mobile */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 md:mb-6 gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold text-white">Painel do Rebanho</h1>
                            <button
                                onClick={handleExportCSV}
                                className="hidden sm:inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-700 hover:bg-green-800 transition-colors"
                            >
                                <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                                Exportar CSV
                            </button>
                        </div>
                        
                        {/* Stats resumidos */}
                        <StatsDashboard animals={filteredAnimals} />
                        
                        {/* Previews de agenda e tarefas - escondidos no mobile para layout mais limpo */}
                        <div className="hidden md:block">
                            <AgendaPreview events={state.calendarEvents} />
                            <TasksPreview tasks={state.tasks} />
                        </div>
                        
                        {/* Filtros colapsáveis - ATUALIZADO com filtro de Sexo */}
                        <FilterBar
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            selectedMedication={selectedMedication}
                            setSelectedMedication={setSelectedMedication}
                            selectedReason={selectedReason}
                            setSelectedReason={setSelectedReason}
                            allMedications={allMedications}
                            allReasons={allReasons}
                            selectedStatus={selectedStatus}
                            setSelectedStatus={setSelectedStatus}
                            selectedSexo={selectedSexo}
                            setSelectedSexo={setSelectedSexo}
                            onClear={handleClearFilters}
                        />
                        
                        {/* Dashboard de animais */}
                        <Dashboard animals={filteredAnimals} onSelectAnimal={handleSelectAnimal} />
                        
                        {/* Botão de exportar CSV - mobile (fixo no fim) */}
                        <div className="sm:hidden mt-6">
                            <button
                                onClick={handleExportCSV}
                                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-700 hover:bg-green-800 transition-colors"
                            >
                                <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                                Exportar CSV
                            </button>
                        </div>
                    </>
                )}

                {currentView === 'reports' && (
                    <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                        <ReportsView animals={state.animals} />
                    </Suspense>
                )}

                {currentView === 'calendar' && (
                    <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                        <CalendarView 
                            events={state.calendarEvents} 
                            onSave={addOrUpdateCalendarEvent} 
                            onDelete={deleteCalendarEvent} 
                        />
                    </Suspense>
                )}

                {currentView === 'tasks' && (
                    <TasksView 
                        tasks={state.tasks} 
                        onAddTask={addTask} 
                        onToggleTask={toggleTaskCompletion}
                        onDeleteTask={deleteTask} 
                    />
                )}

                {currentView === 'management' && (
                    <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                        <ManagementView
                            animals={state.animals}
                            areas={state.managementAreas}
                            onSaveArea={addOrUpdateManagementArea}
                            onDeleteArea={deleteManagementArea}
                            onAssignAnimals={assignAnimalsToArea}
                        />
                    </Suspense>
                )}
            </main>

            <AnimalDetailModal
                animal={selectedAnimal}
                isOpen={!!selectedAnimal}
                onClose={handleCloseModal}
                onUpdateAnimal={handleUpdateAnimal}
                onDeleteAnimal={handleDeleteAnimal}
                animals={state.animals}
                user={user}
            />

            <AddAnimalModal
                isOpen={isAddAnimalModalOpen}
                onClose={() => setIsAddAnimalModalOpen(false)}
                onAddAnimal={handleAddAnimal}
                animals={state.animals}
            />

            {/* Chatbot - com posição ajustada para mobile */}
            <Chatbot animals={state.animals} />
            
            {/* Navbar mobile com botão de adicionar integrado */}
            <MobileNavBar 
                currentView={currentView} 
                setCurrentView={setCurrentView}
                onAddAnimalClick={handleOpenAddAnimalModal}
            />
        </div>
    );
};

export default App;