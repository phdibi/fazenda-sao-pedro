import { useState, useEffect, useCallback } from 'react';
import {
  Animal,
  MedicationAdministration,
  WeightEntry,
  PregnancyRecord,
  PregnancyType,
  AbortionRecord,
  OffspringWeightRecord,
  WeighingType,
  EditableAnimalState,
  MedicationFormState,
  OffspringFormState,
  Sexo,
} from '../../../types';

export interface UseAnimalDetailFormProps {
  animal: Animal | null;
  isOpen: boolean;
  onUpdateAnimal: (animalId: string, updatedData: Partial<Omit<Animal, 'id'>>) => void;
  animals?: Animal[]; // Lista de animais para buscar raça da mãe
}

export interface UseAnimalDetailFormReturn {
  // Estado
  editableAnimal: EditableAnimalState | null;
  isEditing: boolean;
  isSaving: boolean;
  saveError: string | null;
  
  // Formulários
  medicationForm: MedicationFormState;
  newWeightData: { weight: string; type: WeighingType };
  pregnancyForm: Omit<PregnancyRecord, 'id'>;
  abortionDate: string;
  offspringForm: OffspringFormState;
  
  // Ações de estado
  setIsEditing: (editing: boolean) => void;
  setEditableAnimal: React.Dispatch<React.SetStateAction<EditableAnimalState | null>>;
  setMedicationForm: React.Dispatch<React.SetStateAction<MedicationFormState>>;
  setNewWeightData: React.Dispatch<React.SetStateAction<{ weight: string; type: WeighingType }>>;
  setPregnancyForm: React.Dispatch<React.SetStateAction<Omit<PregnancyRecord, 'id'>>>;
  setAbortionDate: React.Dispatch<React.SetStateAction<string>>;
  setOffspringForm: React.Dispatch<React.SetStateAction<OffspringFormState>>;
  
  // Handlers
  handleSaveChanges: () => void;
  handleCancelEdit: () => void;
  handleAnimalFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleUploadComplete: (newUrl: string, thumbnailUrl?: string) => void;
  
  // Medicação
  handleDataExtracted: (data: Partial<MedicationAdministration>) => void;
  handleMedicationFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleAddMedicationSubmit: (e: React.FormEvent) => void;
  handleDeleteMedication: (medId: string) => void;
  handleMedicationDateChange: (medId: string, newDateString: string) => void;
  
  // Peso
  handleAddWeight: (e: React.FormEvent) => void;
  handleDeleteWeight: (weightId: string) => void;
  handleWeightDateChange: (weightId: string, newDateString: string) => void;
  
  // Reprodução
  handleAddPregnancySubmit: (e: React.FormEvent) => void;
  handleDeletePregnancyRecord: (recordId: string) => void;
  handleAddAbortionSubmit: (e: React.FormEvent) => void;
  handleDeleteAbortionRecord: (recordId: string) => void;
  
  // Progênie
  handleAddOrUpdateOffspringSubmit: (e: React.FormEvent) => void;
  handleDeleteOffspringRecord: (recordId: string) => void;
}

export const useAnimalDetailForm = ({
  animal,
  isOpen,
  onUpdateAnimal,
  animals = [],
}: UseAnimalDetailFormProps): UseAnimalDetailFormReturn => {
  // Estados principais
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editableAnimal, setEditableAnimal] = useState<EditableAnimalState | null>(null);

  // Estados de formulário
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>({
    medicamento: '',
    dataAplicacao: new Date(),
    dose: '',
    unidade: 'ml',
    motivo: '',
    responsavel: 'Equipe Campo',
  });

  const [newWeightData, setNewWeightData] = useState({ weight: '', type: WeighingType.None });

  const [pregnancyForm, setPregnancyForm] = useState<Omit<PregnancyRecord, 'id'>>({
    date: new Date(),
    type: PregnancyType.Monta,
    sireName: '',
  });

  const [abortionDate, setAbortionDate] = useState('');

  const [offspringForm, setOffspringForm] = useState<OffspringFormState>({
    offspringBrinco: '',
    birthWeightKg: '',
    weaningWeightKg: '',
    yearlingWeightKg: '',
  });

  // Efeito para sincronizar dados do animal
  useEffect(() => {
    if (animal && !isEditing) {
      const sortedAnimal = {
        ...animal,
        historicoPesagens: [...animal.historicoPesagens].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        historicoSanitario: [...animal.historicoSanitario].sort(
          (a, b) => new Date(a.dataAplicacao).getTime() - new Date(b.dataAplicacao).getTime()
        ),
        historicoPrenhez: [...(animal.historicoPrenhez || [])].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        historicoAborto: [...(animal.historicoAborto || [])].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        historicoProgenie: [...(animal.historicoProgenie || [])],
      };
      const formState = { ...sortedAnimal, pesoKg: String(sortedAnimal.pesoKg) };
      setEditableAnimal(formState);

      if (isOpen) {
        setSaveError(null);
        setNewWeightData({ weight: '', type: WeighingType.None });
      }
    }
  }, [animal, isEditing, isOpen]);

  // === HANDLERS PRINCIPAIS ===

  const handleSaveChanges = useCallback(() => {
    if (editableAnimal && animal) {
      setIsSaving(true);
      setSaveError(null);

      const pesoKgValue = parseFloat(editableAnimal.pesoKg);
      const dataToSave: Partial<Animal> = {
        ...editableAnimal,
        pesoKg: isNaN(pesoKgValue) ? animal.pesoKg : pesoKgValue,
      };

      const { id, ...finalChanges } = dataToSave as Animal;
      onUpdateAnimal(animal.id, finalChanges);

      setTimeout(() => {
        setIsEditing(false);
        setIsSaving(false);
      }, 0);
    }
  }, [editableAnimal, animal, onUpdateAnimal]);

  const handleCancelEdit = useCallback(() => {
    if (animal) {
      const initialFormState = { ...animal, pesoKg: String(animal.pesoKg) };
      setEditableAnimal(initialFormState);
    }
    setIsEditing(false);
    setSaveError(null);
  }, [animal]);

  const handleAnimalFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'dataNascimento') {
      if (value) {
        setEditableAnimal((prev) => (prev ? { ...prev, [name]: new Date(value + 'T00:00:00') } : null));
      } else {
        setEditableAnimal((prev) => (prev ? { ...prev, dataNascimento: undefined } : null));
      }
    } else if (name === 'maeNome') {
      // Busca a raça da mãe automaticamente quando o brinco é informado
      const motherBrinco = value.toLowerCase().trim();
      const mother = animals.find(
        (a) => a.brinco.toLowerCase().trim() === motherBrinco && a.sexo === Sexo.Femea
      );

      if (mother) {
        // Encontrou a mãe - atualiza o brinco, ID e raça
        setEditableAnimal((prev) => prev ? {
          ...prev,
          maeNome: value,
          maeId: mother.id,
          maeRaca: mother.raca
        } : null);
      } else {
        // Não encontrou - atualiza apenas o brinco e limpa o ID/raça
        setEditableAnimal((prev) => prev ? {
          ...prev,
          maeNome: value,
          maeId: undefined,
          maeRaca: undefined
        } : null);
      }
    } else {
      setEditableAnimal((prev) => (prev ? { ...prev, [name]: value } : null));
    }
  }, [animals]);

  const handleUploadComplete = useCallback((newUrl: string, thumbnailUrl?: string) => {
    if (!editableAnimal) return;

    const currentPhotos = editableAnimal.fotos || [];
    const otherPhotos = currentPhotos.filter((p) => !p.includes('cow_placeholder.png'));
    const newPhotos = [newUrl, ...otherPhotos];

    setEditableAnimal((prev) =>
      prev
        ? {
            ...prev,
            fotos: newPhotos,
            ...(thumbnailUrl && { thumbnailUrl }),
          }
        : null
    );

    setIsEditing(true);
  }, [editableAnimal]);

  // === HANDLERS DE MEDICAÇÃO ===

  const handleDataExtracted = useCallback((data: Partial<MedicationAdministration>) => {
    setMedicationForm((prev) => ({
      ...prev,
      medicamento: data.medicamento || prev.medicamento,
      dose: data.dose ? String(data.dose) : prev.dose,
      unidade: data.unidade || prev.unidade,
      motivo: data.motivo || prev.motivo,
      dataAplicacao: new Date(),
    }));
  }, []);

  const handleMedicationFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMedicationForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleAddMedicationSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const doseValue = parseFloat(medicationForm.dose);
    if (isNaN(doseValue) || doseValue <= 0) return;

    const newMedication: MedicationAdministration = {
      ...medicationForm,
      dose: doseValue,
      id: `new-${Date.now()}`,
    };

    setEditableAnimal((prev) => {
      if (!prev) return null;
      const newHistory = [...prev.historicoSanitario, newMedication].sort(
        (a, b) => new Date(a.dataAplicacao).getTime() - new Date(b.dataAplicacao).getTime()
      );
      return { ...prev, historicoSanitario: newHistory };
    });

    setMedicationForm({
      medicamento: '',
      dataAplicacao: new Date(),
      dose: '',
      unidade: 'ml',
      motivo: '',
      responsavel: 'Equipe Campo',
    });
  }, [medicationForm]);

  const handleDeleteMedication = useCallback((medId: string) => {
    setEditableAnimal((prev) => {
      if (!prev) return null;
      return { ...prev, historicoSanitario: prev.historicoSanitario.filter((med) => med.id !== medId) };
    });
  }, []);

  const handleMedicationDateChange = useCallback((medId: string, newDateString: string) => {
    setEditableAnimal((prev) => {
      if (!prev || !newDateString) return prev;
      const newDate = new Date(newDateString + 'T00:00:00');
      const updatedHistory = prev.historicoSanitario.map((entry) =>
        entry.id === medId ? { ...entry, dataAplicacao: newDate } : entry
      );
      updatedHistory.sort((a, b) => new Date(a.dataAplicacao).getTime() - new Date(b.dataAplicacao).getTime());
      return { ...prev, historicoSanitario: updatedHistory };
    });
  }, []);

  // === HANDLERS DE PESO ===

  const handleAddWeight = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const weightValue = parseFloat(newWeightData.weight);
    if (!isNaN(weightValue) && weightValue > 0) {
      const newEntry: WeightEntry = {
        id: `new-${Date.now()}`,
        date: new Date(),
        weightKg: weightValue,
        type: newWeightData.type,
      };

      setEditableAnimal((prev) => {
        if (!prev) return null;
        const newHistory = [...prev.historicoPesagens, newEntry].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const latestWeight = newHistory.length > 0 ? newHistory[newHistory.length - 1].weightKg : 0;
        return { ...prev, historicoPesagens: newHistory, pesoKg: String(latestWeight) };
      });

      setNewWeightData({ weight: '', type: WeighingType.None });
    }
  }, [newWeightData]);

  const handleDeleteWeight = useCallback((weightId: string) => {
    setEditableAnimal((prev) => {
      if (!prev) return null;
      const updatedHistory = prev.historicoPesagens.filter((entry) => entry.id !== weightId);
      const latestWeight = updatedHistory.length > 0 ? updatedHistory[updatedHistory.length - 1].weightKg : 0;
      return { ...prev, historicoPesagens: updatedHistory, pesoKg: String(latestWeight) };
    });
  }, []);

  const handleWeightDateChange = useCallback((weightId: string, newDateString: string) => {
    setEditableAnimal((prev) => {
      if (!prev || !newDateString) return prev;
      const newDate = new Date(newDateString + 'T00:00:00');
      const updatedHistory = prev.historicoPesagens.map((entry) =>
        entry.id === weightId ? { ...entry, date: newDate } : entry
      );
      updatedHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const latestWeight = updatedHistory.length > 0 ? updatedHistory[updatedHistory.length - 1].weightKg : 0;
      return { ...prev, historicoPesagens: updatedHistory, pesoKg: String(latestWeight) };
    });
  }, []);

  // === HANDLERS DE REPRODUÇÃO ===

  const handleAddPregnancySubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: PregnancyRecord = { ...pregnancyForm, id: `new-${Date.now()}` };
    setEditableAnimal((prev) =>
      prev
        ? {
            ...prev,
            historicoPrenhez: [...(prev.historicoPrenhez || []), newRecord].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            ),
          }
        : null
    );
    setPregnancyForm({ date: new Date(), type: PregnancyType.Monta, sireName: '' });
  }, [pregnancyForm]);

  const handleDeletePregnancyRecord = useCallback((recordId: string) => {
    setEditableAnimal((prev) => {
      if (!prev) return null;
      return { ...prev, historicoPrenhez: (prev.historicoPrenhez || []).filter((r) => r.id !== recordId) };
    });
  }, []);

  const handleAddAbortionSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (abortionDate) {
      const newRecord: AbortionRecord = { id: `new-${Date.now()}`, date: new Date(abortionDate + 'T00:00:00') };
      setEditableAnimal((prev) =>
        prev
          ? {
              ...prev,
              historicoAborto: [...(prev.historicoAborto || []), newRecord].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              ),
            }
          : null
      );
      setAbortionDate('');
    }
  }, [abortionDate]);

  const handleDeleteAbortionRecord = useCallback((recordId: string) => {
    setEditableAnimal((prev) => {
      if (!prev) return null;
      return { ...prev, historicoAborto: (prev.historicoAborto || []).filter((r) => r.id !== recordId) };
    });
  }, []);

  // === HANDLERS DE PROGÊNIE ===

  const handleAddOrUpdateOffspringSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!offspringForm.offspringBrinco) return;

    const safeParseFloat = (val: string) => {
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    };

    setEditableAnimal((prev) => {
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
  }, [offspringForm]);

  const handleDeleteOffspringRecord = useCallback((recordId: string) => {
    setEditableAnimal((prev) => {
      if (!prev) return null;
      return { ...prev, historicoProgenie: (prev.historicoProgenie || []).filter((r) => r.id !== recordId) };
    });
  }, []);

  return {
    // Estado
    editableAnimal,
    isEditing,
    isSaving,
    saveError,

    // Formulários
    medicationForm,
    newWeightData,
    pregnancyForm,
    abortionDate,
    offspringForm,

    // Ações de estado
    setIsEditing,
    setEditableAnimal,
    setMedicationForm,
    setNewWeightData,
    setPregnancyForm,
    setAbortionDate,
    setOffspringForm,

    // Handlers
    handleSaveChanges,
    handleCancelEdit,
    handleAnimalFormChange,
    handleUploadComplete,

    // Medicação
    handleDataExtracted,
    handleMedicationFormChange,
    handleAddMedicationSubmit,
    handleDeleteMedication,
    handleMedicationDateChange,

    // Peso
    handleAddWeight,
    handleDeleteWeight,
    handleWeightDateChange,

    // Reprodução
    handleAddPregnancySubmit,
    handleDeletePregnancyRecord,
    handleAddAbortionSubmit,
    handleDeleteAbortionRecord,

    // Progênie
    handleAddOrUpdateOffspringSubmit,
    handleDeleteOffspringRecord,
  };
};
