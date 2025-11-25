import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import { offlineQueue } from './utils/offlineSync';
import Dashboard from './components/Dashboard';
import AnimalDetailModal from './components/AnimalDetailModal';
import AddAnimalModal from './components/AddAnimalModal';
import { useFirestoreData } from './hooks/useFirestoreData';
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
  } = useFirestoreData(user);

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

// Atualiza o debounced quando searchTerm muda
useEffect(() => {
  debouncedSetSearch(searchTerm);
}, [searchTerm, debouncedSetSearch]);
// ✅ Sincronização quando volta online
// ✅ Sincronização quando volta online
useEffect(() => {
  const handleSync = async () => {
    if (db) {
      console.log('🔄 Internet voltou! Sincronizando dados offline...');
      await offlineQueue.processQueue(db);

      // Limpa o localStorage dos animais temporários
      localStorage.removeItem('animals');

      alert('✅ Dados sincronizados com sucesso!');
    }
  };

  window.addEventListener('sync-offline-data', handleSync);

  return () => window.removeEventListener('sync-offline-data', handleSync);
}, [db]);

  const [selectedMedication, setSelectedMedication] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

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
  const matchesSearch = debouncedSearch === '' || // ← AQUI
    animal.brinco.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    animal.nome?.toLowerCase().includes(debouncedSearch.toLowerCase());

        const matchesMedication = selectedMedication === '' ||
          animal.historicoSanitario.some(med => med.medicamento === selectedMedication);

        const matchesReason = selectedReason === '' ||
          animal.historicoSanitario.some(med => med.motivo === selectedReason);

        const matchesStatus = selectedStatus === '' || animal.status === selectedStatus;

        return matchesSearch && matchesMedication && matchesReason && matchesStatus;
      })
      .sort((a, b) => a.brinco.localeCompare(b.brinco));
  }, [state.animals, debouncedSearch, selectedMedication, selectedReason, selectedStatus]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedMedication('');
    setSelectedReason('');
    setSelectedStatus('');
  };

  const handleSelectAnimal = (animal: Animal) => {
    setSelectedAnimalId(animal.id);
  };

  const handleDeleteAnimal = async (animalId: string) => {
    try {
        await deleteAnimal(animalId);
    } catch (error) {
        alert(`Ocorreu um erro ao excluir o animal. A alteração pode ter sido revertida. Verifique sua conexão e tente novamente.`);
        console.error("Deletion failed:", error);
    }
  }

  const handleCloseModal = () => {
    setSelectedAnimalId(null);
  };

  const handleAddAnimal = async (animalData: Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>) => {
  try {
    // ✅ VERIFICA SE ESTÁ ONLINE
    if (navigator.onLine) {
      // 🌐 ONLINE → Salva direto no Firestore
      await addAnimal(animalData);
      setIsAddAnimalModalOpen(false);

    } else {
      // 📡 OFFLINE → Adiciona na fila
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newAnimal = {
        ...animalData,
        id: tempId,
        fotos: [],
        historicoSanitario: [],
        historicoPesagens: []
      };

      // 1. Adiciona na fila de sincronização
      offlineQueue.add({
        type: 'create',
        collection: 'animals',
        data: newAnimal
      });

      // 2. Salva localmente para mostrar imediatamente
      const localAnimals = JSON.parse(localStorage.getItem('animals') || '[]');
      localAnimals.push(newAnimal);
      localStorage.setItem('animals', JSON.stringify(localAnimals));

      // 3. Atualiza o estado local (isso vai fazer aparecer na tela)
      // Nota: você precisa adicionar este animal manualmente no estado
      // ou recarregar do localStorage

      setIsAddAnimalModalOpen(false);

      // Mostra notificação (você pode criar uma função de notificação)
      alert('📱 Animal salvo localmente! Será sincronizado quando a internet voltar.');
    }
  } catch (error) {
    console.error('Erro ao adicionar animal:', error);
    alert('❌ Erro ao adicionar animal');
  }
};
const handleUpdateAnimal = async (animal: Animal) => {
  try {
    if (navigator.onLine) {
      // Online - salva direto
      await updateAnimal(animal);
    } else {
      // Offline - adiciona na fila
      offlineQueue.add({
        type: 'update',
        collection: 'animals',
        data: animal
      });

      // Atualiza localStorage
      const localAnimals = JSON.parse(localStorage.getItem('animals') || '[]');
      const index = localAnimals.findIndex((a: Animal) => a.id === animal.id);

      if (index >= 0) {
        localAnimals[index] = animal;
      } else {
        localAnimals.push(animal);
      }

      localStorage.setItem('animals', JSON.stringify(localAnimals));

      alert('📱 Alterações salvas localmente! Serão sincronizadas quando a internet voltar.');
    }
  } catch (error) {
    console.error('Erro ao atualizar animal:', error);
    alert('❌ Erro ao atualizar animal');
  }
};


  const handleToggleTask = (taskId: string) => {
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
          toggleTaskCompletion(task);
      }
  }

  const handleExportCSV = () => {
    if (filteredAnimals.length === 0) {
        alert("Nenhum animal para exportar com os filtros atuais.");
        return;
    }
    const dataToExport = filteredAnimals.map(animal => ({
        brinco: animal.brinco, nome: animal.nome || '', raca: animal.raca, sexo: animal.sexo, dataNascimento: new Date(animal.dataNascimento).toLocaleDateString('pt-BR'), pesoKg: animal.pesoKg, status: animal.status, paiNome: animal.paiNome || '', maeNome: animal.maeNome || '',
        numMedicacoes: animal.historicoSanitario.length, numPesagens: animal.historicoPesagens.length, numPrenhez: animal.historicoPrenhez?.length || 0, numAbortos: animal.historicoAborto?.length || 0, numProgenie: animal.historicoProgenie?.length || 0,
    }));
    const headers = { brinco: 'Brinco', nome: 'Nome', raca: 'Raça', sexo: 'Sexo', dataNascimento: 'Data de Nascimento', pesoKg: 'Peso Atual (kg)', status: 'Status', paiNome: 'Pai', maeNome: 'Mãe', numMedicacoes: 'Nº Medicações', numPesagens: 'Nº Pesagens', numPrenhez: 'Nº Prenhez', numAbortos: 'Nº Abortos', numProgenie: 'Nº Crias' };
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToCSV(dataToExport, headers, `relatorio_rebanho_${timestamp}.csv`);
  };

  const isAppLoading = state.loading.animals || state.loading.calendar || state.loading.tasks || state.loading.areas;
  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-base-900 flex flex-col justify-center items-center text-white">
        <Spinner />
        <p className="mt-4">Carregando dados da fazenda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-900 font-sans pb-20 md:pb-0">
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        onAddAnimalClick={() => setIsAddAnimalModalOpen(true)}
        user={user}
      />
      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {currentView === 'dashboard' && (
          <>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Painel do Rebanho</h1>
                <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-700 hover:bg-green-800 transition-colors"
                >
                    <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                    Exportar CSV
                </button>
            </div>
            <StatsDashboard animals={filteredAnimals} />
            <AgendaPreview events={state.calendarEvents} />
            <TasksPreview tasks={state.tasks} />
            <FilterBar
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              selectedMedication={selectedMedication} setSelectedMedication={setSelectedMedication}
              selectedReason={selectedReason} setSelectedReason={setSelectedReason}
              allMedications={allMedications} allReasons={allReasons}
              selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus}
              onClear={handleClearFilters}
            />
            <Dashboard animals={filteredAnimals} onSelectAnimal={handleSelectAnimal} />
          </>
        )}

        {currentView === 'reports' && (
          <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
            <ReportsView animals={state.animals} />
          </Suspense>
        )}

        {currentView === 'calendar' && (
          <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
            <CalendarView events={state.calendarEvents} onSave={addOrUpdateCalendarEvent} onDelete={deleteCalendarEvent} />
          </Suspense>
        )}

        {currentView === 'tasks' && <TasksView tasks={state.tasks} onAddTask={addTask} onToggleTask={handleToggleTask} onDeleteTask={deleteTask} />}

        {currentView === 'management' && (
          <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
            <ManagementView
                animals={state.animals} areas={state.managementAreas}
                onSaveArea={addOrUpdateManagementArea} onDeleteArea={deleteManagementArea}
                onAssignAnimals={assignAnimalsToArea}
            />
          </Suspense>
        )}

      </main>
<AnimalDetailModal
  animal={selectedAnimal} 
  isOpen={!!selectedAnimal}
  onClose={handleCloseModal}
  onUpdateAnimal={handleUpdateAnimal} // ← MUDE AQUI (antes era só updateAnimal)
  onDeleteAnimal={handleDeleteAnimal}
  animals={state.animals}
  user={user}
/>
      <AddAnimalModal
        isOpen={isAddAnimalModalOpen} onClose={() => setIsAddAnimalModalOpen(false)}
        onAddAnimal={handleAddAnimal} animals={state.animals}
      />
      <Chatbot animals={state.animals} />
      <MobileNavBar currentView={currentView} setCurrentView={setCurrentView} />
    </div>
  );
};

export default App;
