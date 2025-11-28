import React, { useState, useEffect } from 'react';
import { Animal, MedicationAdministration, WeightEntry, Raca, Sexo, AnimalStatus, PregnancyRecord, PregnancyType, OffspringWeightRecord, WeighingType, AbortionRecord, AppUser } from '../types';
import Modal from './common/Modal';
import ImageAnalyzerOptimized from './ImageAnalyzerOptimized';
import AudioToAction from './AudioToAction';
import { TrashIcon } from './common/Icons';
import GenealogyTree from './GenealogyTree';
import Spinner from './common/Spinner';

interface AnimalDetailModalProps {
  animal: Animal | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateAnimal: (animalId: string, updatedData: Partial<Omit<Animal, 'id'>>) => void;
  onDeleteAnimal: (animalId: string) => Promise<void>;
  animals: Animal[];
  user: AppUser;
}

const formatDate = (date: Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return 'Data inválida';
  }
  return d.toLocaleDateString('pt-BR');
};
const dateToInputValue = (date: Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return '';
  }
  return d.toISOString().split('T')[0];
};

type TabName = 'general' | 'health' | 'weight' | 'genealogy' | 'reproduction' | 'progenie';

// State types for forms to handle string inputs for number fields
type EditableAnimalState = Omit<Animal, 'pesoKg'> & { pesoKg: string };
type MedicationFormState = Omit<MedicationAdministration, 'id' | 'dose'> & { dose: string };
type OffspringFormState = {
    id?: string;
    offspringBrinco: string;
    birthWeightKg: string;
    weaningWeightKg: string;
    yearlingWeightKg: string;
};

interface TabButtonProps {
  tabName: TabName;
  label: string;
  activeTab: TabName;
  onClick: (tabName: TabName) => void;
}

const TabButton = ({ tabName, label, activeTab, onClick }: TabButtonProps) => (
    <button 
      onClick={() => onClick(tabName)} 
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${activeTab === tabName ? 'bg-base-900 text-brand-primary-light border-b-2 border-brand-primary-light' : 'text-gray-400 hover:text-white'}`}>
        {label}
    </button>
);


const AnimalDetailModal = ({ 
    animal, isOpen, onClose, 
    onUpdateAnimal, 
    onDeleteAnimal,
    animals,
    user
}: AnimalDetailModalProps) => {
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>({
      medicamento: '',
      dataAplicacao: new Date(),
      dose: '',
      unidade: 'ml',
      motivo: '',
      responsavel: 'Equipe Campo'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const [editableAnimal, setEditableAnimal] = useState<EditableAnimalState | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');


  const [newWeightData, setNewWeightData] = useState({ weight: '', type: WeighingType.None });
  const [activeTab, setActiveTab] = useState<TabName>('general');
  
  // States for sub-forms
  const [pregnancyForm, setPregnancyForm] = useState<Omit<PregnancyRecord, 'id'>>({ date: new Date(), type: PregnancyType.Monta, sireName: '' });
  const [abortionDate, setAbortionDate] = useState('');
  const [offspringForm, setOffspringForm] = useState<OffspringFormState>({ 
    offspringBrinco: '',
    birthWeightKg: '',
    weaningWeightKg: '',
    yearlingWeightKg: ''
  });

  // This effect runs when a DIFFERENT animal is selected or the parent data changes
  // AND the user is NOT in edit mode. This prevents form data from being overwritten.
  useEffect(() => {
    if (animal && !isEditing) {
        const sortedAnimal = {
            ...animal,
            historicoPesagens: [...animal.historicoPesagens].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
            historicoSanitario: [...animal.historicoSanitario].sort((a, b) => new Date(a.dataAplicacao).getTime() - new Date(b.dataAplicacao).getTime()),
            historicoPrenhez: [...(animal.historicoPrenhez || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
            historicoAborto: [...(animal.historicoAborto || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
            historicoProgenie: [...(animal.historicoProgenie || [])],
        };
        const formState = { ...sortedAnimal, pesoKg: String(sortedAnimal.pesoKg) };
        setEditableAnimal(formState);
        
        if (isOpen) {
            setSaveError(null);
            setNewWeightData({ weight: '', type: WeighingType.None });
            if (activeTab !== 'general' && animal.id !== (editableAnimal?.id || '')) {
                 setActiveTab('general');
            }
        }
    }
  }, [animal, isEditing, isOpen]);

  // --- PHOTO UPLOAD HANDLING ---
  // When a photo is successfully uploaded by ImageAnalyzer, this function
  // updates the local form state and forces the modal into "edit mode".
  // This ensures the photo change is part of the main form save, providing
  // a clear user action to confirm the change.
  const handleUploadComplete = (newUrl: string) => {
    if (!editableAnimal) return;

    const currentPhotos = editableAnimal.fotos || [];
    
    // Prepend the new photo, removing any placeholder images.
    const otherPhotos = currentPhotos.filter(
        p => !p.includes('cow_placeholder.png')
    );
    const newPhotos = [newUrl, ...otherPhotos];
    
    // Update the local state with the new photo array.
    setEditableAnimal(prev => prev ? { ...prev, fotos: newPhotos } : null);
    
    // Force the modal into edit mode so the "Salvar" button appears.
    setIsEditing(true);
  };


  if (!animal || !editableAnimal) return null;

  const handleDataExtracted = (data: Partial<MedicationAdministration>) => {
    setMedicationForm(prev => ({
        ...prev,
        medicamento: data.medicamento || prev.medicamento,
        dose: data.dose ? String(data.dose) : prev.dose,
        unidade: data.unidade || prev.unidade,
        motivo: data.motivo || prev.motivo,
        dataAplicacao: new Date()
    }));
  };
  
  const handleMedicationFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setMedicationForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAnimalFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      if (name === 'dataNascimento') {
          setEditableAnimal(prev => prev ? { ...prev, [name]: new Date(value + 'T00:00:00') } : null);
      } else {
          setEditableAnimal(prev => prev ? { ...prev, [name]: value } : null);
      }
  };
  
    const handleSaveChanges = () => {
        if (editableAnimal && animal) {
            setIsSaving(true);
            setSaveError(null);

            const pesoKgValue = parseFloat(editableAnimal.pesoKg);
            const dataToSave: Partial<Animal> = {
                ...editableAnimal,
                pesoKg: isNaN(pesoKgValue) ? animal.pesoKg : pesoKgValue,
            };

            const { id, ...finalChanges } = dataToSave as Animal;

            // Dispara a atualização otimista e a escrita em segundo plano no banco de dados.
            onUpdateAnimal(animal.id, finalChanges);
            
            // Adia a saída do modo de edição para o próximo ciclo de eventos,
            // permitindo que a atualização otimista seja processada primeiro.
            setTimeout(() => {
                setIsEditing(false);
                setIsSaving(false);
            }, 0);
        }
    };
  
  const handleCancelEdit = () => {
    if (animal) {
        const initialFormState = {...animal, pesoKg: String(animal.pesoKg)};
        setEditableAnimal(initialFormState);
    }
    setIsEditing(false);
    setSaveError(null);
  };
  
  const handleRequestDelete = () => {
      setDeleteConfirmationText('');
      setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
      if (!animal) return;
      if (deleteConfirmationText.trim().toLowerCase() === animal.brinco.toLowerCase()) {
          try {
              await onDeleteAnimal(animal.id);
              setIsDeleteModalOpen(false);
              onClose(); 
          } catch (error) {
              alert("Falha ao excluir o animal. Verifique o console para mais detalhes.");
          }
      } else {
          alert("O número do brinco digitado não confere.");
      }
  };

  const handleDeleteMedication = (medId: string) => {
    setEditableAnimal(prev => {
        if (!prev) return null;
        return { ...prev, historicoSanitario: prev.historicoSanitario.filter(med => med.id !== medId) };
    });
  };

  const handleDeleteWeight = (weightId: string) => {
    setEditableAnimal(prev => {
        if (!prev) return null;
        const updatedHistory = prev.historicoPesagens.filter(entry => entry.id !== weightId);
        const latestWeight = updatedHistory.length > 0 
            ? updatedHistory[updatedHistory.length - 1].weightKg
            : 0;
        return { ...prev, historicoPesagens: updatedHistory, pesoKg: String(latestWeight) };
    });
  };

  const handleDeletePregnancyRecord = (recordId: string) => {
    setEditableAnimal(prev => {
        if (!prev) return null;
        return { ...prev, historicoPrenhez: (prev.historicoPrenhez || []).filter(r => r.id !== recordId) };
    });
  };
  
  const handleDeleteAbortionRecord = (recordId: string) => {
    setEditableAnimal(prev => {
        if (!prev) return null;
        return { ...prev, historicoAborto: (prev.historicoAborto || []).filter(r => r.id !== recordId) };
    });
  };

  const handleDeleteOffspringRecord = (recordId: string) => {
    setEditableAnimal(prev => {
        if (!prev) return null;
        return { ...prev, historicoProgenie: (prev.historicoProgenie || []).filter(r => r.id !== recordId) };
    });
  };
  
  const handleAddMedicationSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const doseValue = parseFloat(medicationForm.dose);
      if (isNaN(doseValue) || doseValue <= 0) return;

      const newMedication: MedicationAdministration = { 
          ...medicationForm, 
          dose: doseValue,
          id: `new-${Date.now()}` 
      };
      setEditableAnimal(prev => {
          if (!prev) return null;
          const newHistory = [...prev.historicoSanitario, newMedication].sort((a,b) => new Date(a.dataAplicacao).getTime() - new Date(b.dataAplicacao).getTime());
          return { ...prev, historicoSanitario: newHistory };
      });
      setMedicationForm({ medicamento: '', dataAplicacao: new Date(), dose: '', unidade: 'ml', motivo: '', responsavel: 'Equipe Campo' });
  };
  
  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const weightValue = parseFloat(newWeightData.weight);
    if (!isNaN(weightValue) && weightValue > 0) {
        const newEntry: WeightEntry = { 
            id: `new-${Date.now()}`,
            date: new Date(), 
            weightKg: weightValue,
            type: newWeightData.type 
        };
        setEditableAnimal(prev => {
            if (!prev) return null;
            const newHistory = [...prev.historicoPesagens, newEntry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const latestWeight = newHistory.length > 0 ? newHistory[newHistory.length - 1].weightKg : 0;
            return { ...prev, historicoPesagens: newHistory, pesoKg: String(latestWeight) };
        });
        setNewWeightData({ weight: '', type: WeighingType.None });
    }
  };

  const handleAddPregnancySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: PregnancyRecord = { ...pregnancyForm, id: `new-${Date.now()}` };
    setEditableAnimal(prev => prev ? { ...prev, historicoPrenhez: [...(prev.historicoPrenhez || []), newRecord].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) } : null);
    setPregnancyForm({ date: new Date(), type: PregnancyType.Monta, sireName: '' });
  };
  
  const handleAddAbortionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (abortionDate) {
        const newRecord: AbortionRecord = { id: `new-${Date.now()}`, date: new Date(abortionDate + 'T00:00:00') };
        setEditableAnimal(prev => prev ? { ...prev, historicoAborto: [...(prev.historicoAborto || []), newRecord].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) } : null);
        setAbortionDate('');
    }
  };

  const handleAddOrUpdateOffspringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offspringForm.offspringBrinco) return;

    const safeParseFloat = (val: string) => {
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
    };

    setEditableAnimal(prev => {
        if (!prev) return null;
        const history = prev.historicoProgenie || [];
        const newRecord: OffspringWeightRecord = {
            id: `new-${Date.now()}`,
            offspringBrinco: offspringForm.offspringBrinco,
            birthWeightKg: safeParseFloat(offspringForm.birthWeightKg),
            weaningWeightKg: safeParseFloat(offspringForm.weaningWeightKg),
            yearlingWeightKg: safeParseFloat(offspringForm.yearlingWeightKg),
        };
        return { ...prev, historicoProgenie: [...history, newRecord] };
    });
    setOffspringForm({ offspringBrinco: '', birthWeightKg: '', weaningWeightKg: '', yearlingWeightKg: '' });
  };
  
  const handleWeightDateChange = (weightId: string, newDateString: string) => {
      setEditableAnimal(prev => {
          if (!prev || !newDateString) return prev;
          
          const newDate = new Date(newDateString + 'T00:00:00');
          const updatedHistory = prev.historicoPesagens.map(entry =>
              entry.id === weightId ? { ...entry, date: newDate } : entry
          );
          updatedHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          const latestWeight = updatedHistory.length > 0 
              ? updatedHistory[updatedHistory.length - 1].weightKg 
              : 0;

          return { ...prev, historicoPesagens: updatedHistory, pesoKg: String(latestWeight) };
      });
  };
  
  const handleMedicationDateChange = (medId: string, newDateString: string) => {
      setEditableAnimal(prev => {
          if (!prev || !newDateString) return prev;
          const newDate = new Date(newDateString + 'T00:00:00');
          const updatedHistory = prev.historicoSanitario.map(entry =>
              entry.id === medId ? { ...entry, dataAplicacao: newDate } : entry
          );
          updatedHistory.sort((a, b) => new Date(a.dataAplicacao).getTime() - new Date(b.dataAplicacao).getTime());
          return { ...prev, historicoSanitario: updatedHistory };
      });
  };
  
  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes do Animal: ${animal.nome || `Brinco ${animal.brinco}`}`}>
      <div className="border-b border-base-700 overflow-x-auto">
         <nav className="flex space-x-4">
             <TabButton tabName="general" label="Dados Gerais" activeTab={activeTab} onClick={setActiveTab} />
             <TabButton tabName="health" label="Histórico Sanitário" activeTab={activeTab} onClick={setActiveTab} />
             <TabButton tabName="weight" label="Histórico de Pesagens" activeTab={activeTab} onClick={setActiveTab} />
             {animal.sexo === Sexo.Femea && <TabButton tabName="reproduction" label="Reprodução" activeTab={activeTab} onClick={setActiveTab} />}
             {animal.sexo === Sexo.Femea && <TabButton tabName="progenie" label="Progênie" activeTab={activeTab} onClick={setActiveTab} />}
             <TabButton tabName="genealogy" label="Genealogia" activeTab={activeTab} onClick={setActiveTab} />
         </nav>
      </div>

      {/* ADICIONEI pb-48 md:pb-4 aqui ↓ */}
      <div className="mt-4 min-h-[50vh] pb-48 md:pb-4">
        {activeTab === 'general' && 
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ImageAnalyzerOptimized 
                  imageUrl={editableAnimal.fotos[0]} 
                  onUploadComplete={handleUploadComplete}
                  animalId={animal.id}
                  userId={user.uid} 
              />
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><strong className="block text-gray-400">Brinco</strong> <span className="text-lg font-bold text-brand-primary-light">{animal.brinco}</span></div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400">Nome</label>
                  <input type="text" name="nome" value={editableAnimal.nome || ''} onChange={handleAnimalFormChange} className="bg-base-700 w-full p-1 rounded border border-base-600" disabled={!isEditing}/>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400">Raça</label>
                  <select name="raca" value={editableAnimal.raca} onChange={handleAnimalFormChange} className="bg-base-700 w-full p-1 rounded border border-base-600" disabled={!isEditing}>
                      {Object.values(Raca).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400">Sexo</label>
                  <select name="sexo" value={editableAnimal.sexo} onChange={handleAnimalFormChange} className="bg-base-700 w-full p-1 rounded border border-base-600" disabled={!isEditing}>
                      {Object.values(Sexo).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400">Nascimento</label>
                  <input type="date" name="dataNascimento" value={dateToInputValue(editableAnimal.dataNascimento)} onChange={handleAnimalFormChange} className="bg-base-700 w-full p-1 rounded border border-base-600" disabled={!isEditing}/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400">Peso (atual)</label>
                  <input type="number" name="pesoKg" value={editableAnimal.pesoKg} onChange={handleAnimalFormChange} className="bg-base-700 w-full p-1 rounded border border-base-600" disabled={!isEditing}/>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-400">Status</label>
                   <select name="status" value={editableAnimal.status} onChange={handleAnimalFormChange} className="bg-base-700 w-full p-1 rounded border border-base-600" disabled={!isEditing}>
                      {Object.values(AnimalStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Brinco da Mãe</label>
                        <input type="text" name="maeNome" value={editableAnimal.maeNome || ''} onChange={handleAnimalFormChange} className="bg-base-700 w-full p-1 rounded border border-base-600" disabled={!isEditing} placeholder="Ex: 2024"/>
                        <p className="text-xs text-gray-500 mt-1">A raça será puxada automaticamente</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Pai (Brinco ou Nome)</label>
                        <input type="text" name="paiNome" value={editableAnimal.paiNome || ''} onChange={handleAnimalFormChange} className="bg-base-700 w-full p-1 rounded border border-base-600" disabled={!isEditing} placeholder="Ex: Touro 001"/>
                    </div>
                </div>

              </div>
            </div>
          </div>
        }

        {activeTab === 'health' && (
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Histórico Sanitário</h3>
                <div className="max-h-48 overflow-y-auto bg-base-900 p-2 rounded-lg mb-4">
                  {editableAnimal.historicoSanitario.length === 0 ? <p className="text-gray-500 text-center">Nenhum registro.</p> :
                  [...editableAnimal.historicoSanitario].reverse().map(med => (
                      <div key={med.id} className="flex flex-col md:flex-row md:items-center justify-between gap-x-4 gap-y-1 text-sm p-2 border-b border-base-700">
                          <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                            {isEditing ? (
                                <input 
                                    type="date" 
                                    value={dateToInputValue(new Date(med.dataAplicacao))}
                                    onChange={(e) => handleMedicationDateChange(med.id, e.target.value)}
                                    className="bg-base-700 p-1 rounded border border-base-600 w-full sm:w-32"
                                />
                            ) : (
                                <span className="w-24">{formatDate(med.dataAplicacao)}</span>
                            )}
                            <span className="font-bold">{med.medicamento}</span>
                            <span className="text-gray-300">{med.dose} {med.unidade}</span>
                          </div>
                          <div className="flex-1 text-left md:text-right text-gray-400 italic">
                            {med.motivo}
                          </div>
                           <div className="text-right">
                              {isEditing && (
                                <button onClick={() => handleDeleteMedication(med.id)} className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400" aria-label="Excluir registro sanitário">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                          </div>
                      </div>
                  ))}
                </div>
                {isEditing && (
                    <>
                        <AudioToAction onDataExtracted={handleDataExtracted} />
                        <form onSubmit={handleAddMedicationSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input type="text" name="medicamento" placeholder="Medicamento" value={medicationForm.medicamento} onChange={handleMedicationFormChange} className="bg-base-700 p-2 rounded" required />
                            <input type="number" name="dose" placeholder="Dose" value={medicationForm.dose} onChange={handleMedicationFormChange} className="bg-base-700 p-2 rounded" required />
                            <select name="unidade" value={medicationForm.unidade} onChange={handleMedicationFormChange} className="bg-base-700 p-2 rounded"><option value="ml">ml</option><option value="mg">mg</option><option value="dose">dose</option></select>
                            <input type="text" name="motivo" placeholder="Motivo" value={medicationForm.motivo} onChange={handleMedicationFormChange} className="bg-base-700 p-2 rounded col-span-1 md:col-span-2" required />
                            <button type="submit" className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 rounded">Adicionar Registro</button>
                        </form>
                    </>
                )}
            </div>
        )}

        {activeTab === 'weight' && (
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Histórico de Pesagens</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="max-h-60 overflow-y-auto bg-base-900 p-2 rounded-lg">
                        {editableAnimal.historicoPesagens.length === 0 ? <p className="text-gray-500 text-center">Nenhum registro.</p> :
                        [...editableAnimal.historicoPesagens].reverse().map(entry => (
                            <div key={entry.id} className="flex justify-between items-center p-2 border-b border-base-700">
                                <div className="flex-1 flex items-center gap-2">
                                  {isEditing ? (
                                      <input 
                                          type="date" 
                                          value={dateToInputValue(new Date(entry.date))}
                                          onChange={(e) => handleWeightDateChange(entry.id, e.target.value)}
                                          className="bg-base-700 p-1 rounded border border-base-600 w-32"
                                      />
                                  ) : (
                                      <span>{formatDate(entry.date)}</span>
                                  )}
                                  {entry.type && entry.type !== WeighingType.None && <span className="ml-2 text-xs bg-brand-accent-dark text-white/90 px-2 py-0.5 rounded-full">{entry.type}</span>}
                                </div>
                                <span className="font-bold w-20 text-right">{entry.weightKg} kg</span>
                                <div className="w-10 text-right">
                                  {isEditing && (
                                    <button onClick={() => handleDeleteWeight(entry.id)} className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400" aria-label="Excluir pesagem">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {isEditing && (
                        <form onSubmit={handleAddWeight} className="bg-base-900 p-4 rounded-lg">
                            <h4 className="font-semibold mb-2">Adicionar Nova Pesagem</h4>
                            <div className="flex flex-col md:flex-row gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400">Peso (kg)</label>
                                    <input type="number" step="0.1" value={newWeightData.weight} onChange={(e) => setNewWeightData(p => ({...p, weight: e.target.value}))} className="w-full bg-base-700 p-2 rounded" placeholder="Novo peso em kg" required />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-400">Tipo de Pesagem</label>
                                    <select value={newWeightData.type} onChange={(e) => setNewWeightData(p => ({...p, type: e.target.value as WeighingType}))} className="w-full bg-base-700 p-2 rounded">
                                        {Object.values(WeighingType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <button type="submit" className="self-end bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 rounded">Salvar</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        )}
          
        {activeTab === 'genealogy' && <GenealogyTree animal={animal} allAnimals={animals} />}
        
        {activeTab === 'reproduction' && animal.sexo === Sexo.Femea && (
            <div className="mt-6">
                <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Histórico Reprodutivo</h3>
                    <div className="max-h-48 overflow-y-auto bg-base-900 p-2 rounded-lg mb-4">
                        {(editableAnimal.historicoPrenhez || []).length === 0 ? <p className="text-gray-500 text-center">Nenhum registro.</p> :
                        [...(editableAnimal.historicoPrenhez || [])].reverse().map(record => (
                             <div key={record.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 text-sm p-2 border-b border-base-700 items-center">
                                <span className="col-span-2">{formatDate(record.date)}</span>
                                <span className="font-bold col-span-2">{record.type}</span>
                                <span>{record.sireName}</span>
                                <div className="flex gap-2">
                                    {isEditing && (
                                         <button onClick={() => handleDeletePregnancyRecord(record.id)} className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400" aria-label="Excluir registro de prenhez">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {isEditing && (
                        <form onSubmit={handleAddPregnancySubmit} className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4 bg-base-900 p-4 rounded-lg">
                            <h4 className="text-md font-semibold text-white col-span-full mb-2">Adicionar Novo Registro</h4>
                            <div>
                                <label className="text-xs text-gray-400">Data</label>
                                <input type="date" name="date" value={dateToInputValue(pregnancyForm.date)} onChange={e => setPregnancyForm(p => ({...p, date: new Date(e.target.value + 'T00:00:00')}))} className="w-full bg-base-700 p-2 rounded" required />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-gray-400">Tipo</label>
                                <select name="type" value={pregnancyForm.type} onChange={e => setPregnancyForm(p => ({...p, type: e.target.value as PregnancyType}))} className="w-full bg-base-700 p-2 rounded">
                                    {Object.values(PregnancyType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Reprodutor</label>
                                <input type="text" name="sireName" placeholder="Nome do Touro" value={pregnancyForm.sireName} onChange={e => setPregnancyForm(p => ({...p, sireName: e.target.value}))} className="w-full bg-base-700 p-2 rounded" required />
                            </div>
                            <div className="self-end">
                                <button type="submit" className="w-full bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 rounded">Adicionar</button>
                            </div>
                        </form>
                    )}
                </div>

                <div className="mt-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Histórico de Abortos</h3>
                    <div className="max-h-48 overflow-y-auto bg-base-900 p-2 rounded-lg mb-4">
                        {(editableAnimal.historicoAborto || []).length === 0 ? (
                            <p className="text-gray-500 text-center">Nenhum registro de aborto.</p>
                        ) : (
                            [...(editableAnimal.historicoAborto || [])].reverse().map(record => (
                                <div key={record.id} className="grid grid-cols-3 gap-2 text-sm p-2 border-b border-base-700 items-center">
                                    <span className="col-span-2">Data do Ocorrido: <span className="font-bold">{formatDate(record.date)}</span></span>
                                    {isEditing && (
                                        <div className="text-right">
                                            <button onClick={() => handleDeleteAbortionRecord(record.id)} className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400" aria-label="Excluir registro de aborto">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    {isEditing && (
                        <form onSubmit={handleAddAbortionSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-900 p-4 rounded-lg">
                            <h4 className="text-md font-semibold text-white col-span-full mb-2">Adicionar Registro de Aborto</h4>
                            <div className="md:col-span-2">
                                <label className="text-xs text-gray-400">Data do Ocorrido</label>
                                <input type="date" value={abortionDate} onChange={(e) => setAbortionDate(e.target.value)} className="w-full bg-base-700 p-2 rounded" required />
                            </div>
                            <div className="self-end">
                                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold p-2 rounded">Registrar Aborto</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        )}
        
        {activeTab === 'progenie' && animal.sexo === Sexo.Femea && (
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Histórico de Performance da Progênie</h3>
                <div className="bg-base-900 p-2 rounded-lg mb-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-base-700">
                        <thead className="bg-base-800/50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Brinco do Filho</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Nascimento (kg)</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Desmame (kg)</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Sobreano (kg)</th>
                                {isEditing && <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-700">
                            {(editableAnimal.historicoProgenie || []).map(record => (
                                <tr key={record.id}>
                                    <td className="px-4 py-2 text-sm text-white">{record.offspringBrinco}</td>
                                    <td className="px-4 py-2 text-sm text-gray-300">{record.birthWeightKg || '–'}</td>
                                    <td className="px-4 py-2 text-sm text-gray-300">{record.weaningWeightKg || '–'}</td>
                                    <td className="px-4 py-2 text-sm text-gray-300">{record.yearlingWeightKg || '–'}</td>
                                    {isEditing && (
                                        <td className="px-4 py-2">
                                            <button onClick={() => handleDeleteOffspringRecord(record.id)} className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400" aria-label="Excluir registro de progênie">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {(editableAnimal.historicoProgenie || []).length === 0 && (
                                <tr><td colSpan={isEditing ? 5 : 4} className="text-center text-gray-500 py-4">Nenhum registro de progênie.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {isEditing && (
                    <form onSubmit={handleAddOrUpdateOffspringSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4 bg-base-900 p-4 rounded-lg">
                        <h4 className="text-md font-semibold text-white col-span-full mb-2">Adicionar Registro de Progênie</h4>
                        <div className="md:col-span-2">
                            <label className="text-xs text-gray-400">Brinco do Filho</label>
                            <input type="text" name="offspringBrinco" placeholder="Brinco" value={offspringForm.offspringBrinco} onChange={e => setOffspringForm(p => ({...p, offspringBrinco: e.target.value}))} className="w-full bg-base-700 p-2 rounded" required />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Peso Nasc. (kg)</label>
                            <input type="number" step="0.1" name="birthWeightKg" placeholder="kg" value={offspringForm.birthWeightKg} onChange={e => setOffspringForm(p => ({...p, birthWeightKg: e.target.value}))} className="w-full bg-base-700 p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Peso Desm. (kg)</label>
                            <input type="number" step="0.1" name="weaningWeightKg" placeholder="kg" value={offspringForm.weaningWeightKg} onChange={e => setOffspringForm(p => ({...p, weaningWeightKg: e.target.value}))} className="w-full bg-base-700 p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Peso Sobreano (kg)</label>
                            <input type="number" step="0.1" name="yearlingWeightKg" placeholder="kg" value={offspringForm.yearlingWeightKg} onChange={e => setOffspringForm(p => ({...p, yearlingWeightKg: e.target.value}))} className="w-full bg-base-700 p-2 rounded" />
                        </div>
                        <div className="col-span-full flex justify-end gap-2 mt-2">
                            <button type="submit" className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 px-4 rounded">Salvar</button>
                        </div>
                    </form>
                )}
            </div>
        )}
      </div>

       {/* Error Display */}
      {isEditing && saveError && (
        <div className="text-red-400 text-sm bg-red-900/30 p-3 rounded-md mt-4 text-center">
            <strong>Falha ao Salvar:</strong> {saveError}
        </div>
      )}

       {/* ADICIONEI mb-24 mt-6 aqui ↓ */}
       <div className="flex justify-between items-center gap-2 p-4 mt-6 mb-24 border-t border-base-700">
            <div>
                {!isEditing && (
                    <button onClick={handleRequestDelete} className="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2">
                        <TrashIcon className="w-5 h-5"/> Excluir Animal
                    </button>
                )}
            </div>
            <div className="flex gap-2">
                {isEditing ? (
                    <>
                        <button 
                            onClick={handleCancelEdit} 
                            disabled={isSaving}
                            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50">
                            Cancelar
                        </button>
                         <button 
                            onClick={handleSaveChanges} 
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center w-28"
                            disabled={isSaving}>
                            {isSaving ? <Spinner /> : 'Salvar'}
                        </button>
                    </>
                ) : (
                    <button onClick={() => setIsEditing(true)} className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded flex items-center gap-2 transition-colors">
                        Editar
                    </button>
                )}
            </div>
        </div>
    </Modal>

    {/* Delete Confirmation Modal */}
    <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão">
        <div className="text-white">
            <p className="text-lg">Você tem certeza que deseja excluir permanentemente o animal com brinco <strong className="text-brand-primary-light">{animal.brinco}</strong>?</p>
            <p className="mt-2 text-sm text-gray-400">Esta ação não pode ser desfeita. Todos os dados associados a este animal serão perdidos.</p>
            <div className="mt-6">
                <label htmlFor="delete-confirm-input" className="block text-sm font-medium text-gray-300">
                    Para confirmar, digite o brinco do animal: <span className="font-bold">{animal.brinco}</span>
                </label>
                <input 
                    type="text" 
                    id="delete-confirm-input"
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm p-2"
                />
            </div>
            <div className="mt-6 flex justify-end gap-4">
                <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="bg-base-700 text-gray-300 hover:bg-base-600 font-bold py-2 px-4 rounded transition-colors">
                    Cancelar
                </button>
                <button 
                    type="button" 
                    onClick={handleConfirmDelete}
                    disabled={deleteConfirmationText.trim().toLowerCase() !== animal.brinco.toLowerCase()}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-red-900 disabled:cursor-not-allowed"
                >
                    Confirmar Exclusão
                </button>
            </div>
        </div>
    </Modal>
    </>
  );
};

export default AnimalDetailModal;
