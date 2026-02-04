import { useState, useCallback } from 'react';
import { Animal, WeighingType, WeightEntry, MedicationAdministration, MedicationItem } from '../types';
import { useFarmData } from '../contexts/FarmContext';
import { offlineQueue } from '../utils/offlineSync';

export const useAnimalActions = (userUid: string) => {
    const { firestore } = useFarmData();
    const { state, updateAnimal, addAnimal, deleteAnimal } = firestore;

    // Helper to get animal by ID from the current state
    const getAnimal = useCallback((animalId: string) => {
        return state.animals.find(a => a.id === animalId);
    }, [state.animals]);

    const handleAddAnimal = async (animalData: Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>) => {
        try {
            if (navigator.onLine) {
                await addAnimal(animalData);
            } else {
                offlineQueue.add({
                    type: 'create',
                    collection: 'animals',
                    data: {
                        ...animalData,
                        userId: userUid
                    }
                });
                alert('📱 Animal salvo localmente! Será sincronizado quando a internet voltar.');
            }
        } catch (error) {
            console.error('Erro ao adicionar animal:', error);
            alert('❌ Erro ao adicionar animal');
            throw error;
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
            throw error;
        }
    };

    const handleDeleteAnimal = async (animalId: string) => {
        try {
            await deleteAnimal(animalId);
        } catch (error) {
            console.error("Deletion failed:", error);
            alert(`Ocorreu um erro ao excluir o animal.`);
            throw error;
        }
    };

    const handleQuickWeightSave = async (animalId: string, weight: number, type: WeighingType) => {
        try {
            const animal = getAnimal(animalId);
            if (!animal) return;

            const newEntry: WeightEntry = {
                id: `quick-${Date.now()}`,
                date: new Date(),
                weightKg: weight,
                type: type === WeighingType.None ? undefined : type,
            };

            const historicoPesagens = [...(animal.historicoPesagens || []), newEntry]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            if (navigator.onLine) {
                await updateAnimal(animalId, {
                    historicoPesagens,
                    pesoKg: weight,
                });
            } else {
                offlineQueue.add({
                    type: 'update',
                    collection: 'animals',
                    data: { id: animalId, historicoPesagens, pesoKg: weight }
                });
                alert('📱 Peso salvo localmente! Será sincronizado quando a internet voltar.');
            }
        } catch (error) {
            console.error('Erro ao salvar peso:', error);
            alert('❌ Erro ao salvar peso');
        }
    };

    const handleQuickMedicationSave = async (animalId: string, medication: Omit<MedicationAdministration, 'id'>) => {
        try {
            const animal = getAnimal(animalId);
            if (!animal) return;

            // Garante que medicamentos[] existe (suporte ao novo formato)
            const medicamentos: MedicationItem[] = medication.medicamentos && medication.medicamentos.length > 0
                ? medication.medicamentos
                : medication.medicamento
                    ? [{ medicamento: medication.medicamento, dose: medication.dose || 0, unidade: medication.unidade || 'ml' }]
                    : [];

            const newMedication: MedicationAdministration = {
                id: `med-${Date.now()}`,
                medicamentos,
                dataAplicacao: medication.dataAplicacao,
                motivo: medication.motivo,
                responsavel: medication.responsavel,
                // Campos legados para compatibilidade
                medicamento: medicamentos[0]?.medicamento,
                dose: medicamentos[0]?.dose,
                unidade: medicamentos[0]?.unidade,
            };

            const historicoSanitario = [...(animal.historicoSanitario || []), newMedication];

            if (navigator.onLine) {
                await updateAnimal(animalId, { historicoSanitario });
            } else {
                offlineQueue.add({
                    type: 'update',
                    collection: 'animals',
                    data: { id: animalId, historicoSanitario }
                });
                alert('📱 Medicacao salva localmente! Sera sincronizada quando a internet voltar.');
            }
        } catch (error) {
            console.error('Erro ao salvar medicacao:', error);
            alert('❌ Erro ao salvar medicacao');
        }
    };

    const handleScaleImportComplete = async (
        weightsMap: Map<string, { weight: number; date: Date; type: WeighingType }>
    ) => {
        try {
            const updates: Promise<void>[] = [];

            weightsMap.forEach((data, animalId) => {
                const animal = getAnimal(animalId);
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

    return {
        handleAddAnimal,
        handleUpdateAnimal,
        handleDeleteAnimal,
        handleQuickWeightSave,
        handleQuickMedicationSave,
        handleScaleImportComplete
    };
};
