import React, { useState, useMemo } from 'react';
import { ManagementBatch, BatchPurpose, Animal, WeighingType } from '../types';
import Modal from './common/Modal';

const COMMON_MEDICATIONS = [
  'Ivermectina',
  'Doramectina',
  'Vacina Aftosa',
  'Vacina Carbunculo',
];

interface BatchManagementProps {
  batches: ManagementBatch[];
  animals: Animal[];
  onCreateBatch: (batch: Omit<ManagementBatch, 'id'>) => void;
  onUpdateBatch: (batchId: string, data: Partial<ManagementBatch>) => void;
  onDeleteBatch: (batchId: string) => void;
  onCompleteBatch: (batchId: string, completionData?: Partial<ManagementBatch>) => Promise<void> | void;
}

const BatchManagement: React.FC<BatchManagementProps> = ({
  batches,
  animals,
  onCreateBatch,
  onUpdateBatch,
  onDeleteBatch,
  onCompleteBatch,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ManagementBatch | null>(null);
  const [newBatch, setNewBatch] = useState({
    name: '',
    description: '',
    purpose: BatchPurpose.Pesagem,
    animalIds: [] as string[],
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Estado do modal de conclusão
  const [completionBatch, setCompletionBatch] = useState<ManagementBatch | null>(null);
  const [medicationForm, setMedicationForm] = useState({
    medicamento: '',
    dose: '',
    unidade: 'ml' as 'ml' | 'mg' | 'dose',
    responsavel: 'Equipe Campo',
  });
  const [animalWeights, setAnimalWeights] = useState<Record<string, string>>({});
  const [weighingType, setWeighingType] = useState<WeighingType>(WeighingType.None);

  const activeBatches = useMemo(() =>
    batches.filter(b => b.status === 'active'),
    [batches]
  );

  const completedBatches = useMemo(() =>
    batches.filter(b => b.status === 'completed').slice(0, 5),
    [batches]
  );

  const filteredAnimals = useMemo(() => {
    if (!searchTerm) return animals.slice(0, 50);
    const term = searchTerm.toLowerCase();
    return animals.filter(a =>
      a.brinco.toLowerCase().includes(term) ||
      a.nome?.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [animals, searchTerm]);

  const handleCreateBatch = () => {
    if (!newBatch.name.trim()) return;

    onCreateBatch({
      name: newBatch.name,
      description: newBatch.description,
      purpose: newBatch.purpose,
      animalIds: newBatch.animalIds,
      createdAt: new Date(),
      status: 'active',
    });

    setNewBatch({ name: '', description: '', purpose: BatchPurpose.Pesagem, animalIds: [] });
    setIsCreateModalOpen(false);
  };

  const toggleAnimalInBatch = (animalId: string) => {
    setNewBatch(prev => ({
      ...prev,
      animalIds: prev.animalIds.includes(animalId)
        ? prev.animalIds.filter(id => id !== animalId)
        : [...prev.animalIds, animalId],
    }));
  };

  const getAnimalById = (id: string) => animals.find(a => a.id === id);

  // Abre o modal de conclusão
  const openCompletionModal = (batch: ManagementBatch) => {
    setCompletionBatch(batch);
    setMedicationForm({ medicamento: '', dose: '', unidade: 'ml', responsavel: 'Equipe Campo' });
    setAnimalWeights({});
    setWeighingType(WeighingType.None);
  };

  // Handler de conclusão do lote com sincronização
  const [isCompleting, setIsCompleting] = useState(false);

  const handleCompleteBatch = async () => {
    if (!completionBatch || isCompleting) return;

    let completionData: Partial<ManagementBatch> = {};

    switch (completionBatch.purpose) {
      case BatchPurpose.Vacinacao:
      case BatchPurpose.Vermifugacao: {
        if (!medicationForm.medicamento.trim()) return;
        completionData = {
          medicationData: {
            medicamento: medicationForm.medicamento,
            dose: parseFloat(medicationForm.dose) || 0,
            unidade: medicationForm.unidade,
            responsavel: medicationForm.responsavel || 'Equipe Campo',
          }
        };
        break;
      }
      case BatchPurpose.Pesagem: {
        const weights: Record<string, number> = {};
        Object.entries(animalWeights).forEach(([id, val]) => {
          const num = parseFloat(val);
          if (num > 0) weights[id] = num;
        });
        completionData = { animalWeights: weights, weighingType };
        break;
      }
      case BatchPurpose.Desmame: {
        const weights: Record<string, number> = {};
        Object.entries(animalWeights).forEach(([id, val]) => {
          const num = parseFloat(val);
          if (num > 0) weights[id] = num;
        });
        completionData = { animalWeights: weights };
        break;
      }
      default:
        break;
    }

    setIsCompleting(true);
    try {
      await onCompleteBatch(completionBatch.id, completionData);
      setCompletionBatch(null);
      setSelectedBatch(null);
    } catch (error: any) {
      alert(error?.message || 'Erro ao concluir lote. Tente novamente.');
    } finally {
      setIsCompleting(false);
    }
  };

  // Verifica se o formulário de conclusão é válido
  const isCompletionValid = (): boolean => {
    if (!completionBatch) return false;
    switch (completionBatch.purpose) {
      case BatchPurpose.Vacinacao:
      case BatchPurpose.Vermifugacao:
        return !!medicationForm.medicamento.trim();
      case BatchPurpose.Pesagem:
      case BatchPurpose.Desmame:
        return Object.values(animalWeights).some(v => parseFloat(v) > 0);
      default:
        return true;
    }
  };

  // Título do modal de conclusão baseado no propósito
  const getCompletionTitle = (): string => {
    if (!completionBatch) return '';
    switch (completionBatch.purpose) {
      case BatchPurpose.Venda: return 'Confirmar Venda';
      case BatchPurpose.Vacinacao: return 'Dados da Vacinacao';
      case BatchPurpose.Vermifugacao: return 'Dados da Vermifugacao';
      case BatchPurpose.Pesagem: return 'Registrar Pesagem';
      case BatchPurpose.Desmame: return 'Registrar Desmame';
      default: return 'Concluir Lote';
    }
  };

  const purposeColors: Record<BatchPurpose, string> = {
    [BatchPurpose.Vacinacao]: 'bg-red-600',
    [BatchPurpose.Vermifugacao]: 'bg-orange-600',
    [BatchPurpose.Pesagem]: 'bg-blue-600',
    [BatchPurpose.Venda]: 'bg-green-600',
    [BatchPurpose.Desmame]: 'bg-purple-600',
    [BatchPurpose.Confinamento]: 'bg-yellow-600',
    [BatchPurpose.Exposicao]: 'bg-pink-600',
    [BatchPurpose.Apartacao]: 'bg-cyan-600',
    [BatchPurpose.Outros]: 'bg-gray-600',
  };

  // Renderiza o conteúdo do modal de conclusão baseado no propósito
  const renderCompletionContent = () => {
    if (!completionBatch) return null;

    switch (completionBatch.purpose) {
      case BatchPurpose.Venda:
        return (
          <div className="space-y-4">
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4">
              <p className="text-amber-200 text-sm">
                Ao concluir este lote de <strong>Venda</strong>, os <strong>{completionBatch.animalIds.length} animais</strong> serao
                marcados como <strong>"Vendido"</strong> no sistema.
              </p>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {completionBatch.animalIds.map(id => {
                const animal = getAnimalById(id);
                if (!animal) return null;
                return (
                  <div key={id} className="flex justify-between items-center p-2 bg-base-700 rounded text-sm">
                    <span className="text-white">{animal.brinco}</span>
                    {animal.nome && <span className="text-gray-400">{animal.nome}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case BatchPurpose.Vacinacao:
      case BatchPurpose.Vermifugacao:
        return (
          <div className="space-y-4">
            <div className="bg-base-900 rounded-lg p-3">
              <p className="text-gray-300 text-sm">
                {completionBatch.purpose === BatchPurpose.Vacinacao
                  ? 'A vacina sera registrada no historico sanitario de cada animal.'
                  : 'O vermifugo sera registrado no historico sanitario de cada animal.'}
              </p>
              <p className="text-gray-500 text-xs mt-1">{completionBatch.animalIds.length} animais no lote</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Medicamento *</label>
              <input
                type="text"
                value={medicationForm.medicamento}
                onChange={(e) => setMedicationForm(prev => ({ ...prev, medicamento: e.target.value }))}
                placeholder="Nome do medicamento"
                className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {COMMON_MEDICATIONS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMedicationForm(prev => ({ ...prev, medicamento: m }))}
                    className={`px-2 py-1 text-xs rounded ${
                      medicationForm.medicamento === m
                        ? 'bg-brand-primary text-white'
                        : 'bg-base-600 text-gray-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Dose</label>
                <input
                  type="number"
                  value={medicationForm.dose}
                  onChange={(e) => setMedicationForm(prev => ({ ...prev, dose: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
                />
              </div>
              <div className="w-24">
                <label className="block text-sm text-gray-400 mb-1">Unidade</label>
                <select
                  value={medicationForm.unidade}
                  onChange={(e) => setMedicationForm(prev => ({ ...prev, unidade: e.target.value as 'ml' | 'mg' | 'dose' }))}
                  className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
                >
                  <option value="ml">ml</option>
                  <option value="mg">mg</option>
                  <option value="dose">dose</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Responsavel</label>
              <input
                type="text"
                value={medicationForm.responsavel}
                onChange={(e) => setMedicationForm(prev => ({ ...prev, responsavel: e.target.value }))}
                className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
              />
            </div>
          </div>
        );

      case BatchPurpose.Pesagem:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipo de Pesagem</label>
              <div className="flex flex-wrap gap-2">
                {Object.values(WeighingType).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setWeighingType(t)}
                    className={`px-3 py-1.5 text-xs rounded-lg ${
                      weighingType === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-base-700 text-gray-300 hover:bg-base-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Pesos por Animal ({completionBatch.animalIds.length} animais)
              </label>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {completionBatch.animalIds.map(id => {
                  const animal = getAnimalById(id);
                  if (!animal) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 p-2 bg-base-700 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-medium">{animal.brinco}</span>
                        {animal.nome && <span className="text-gray-400 text-xs ml-1">({animal.nome})</span>}
                        <span className="text-gray-500 text-xs ml-2">Atual: {animal.pesoKg}kg</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={animalWeights[id] || ''}
                        onChange={(e) => setAnimalWeights(prev => ({ ...prev, [id]: e.target.value }))}
                        placeholder="kg"
                        className="w-24 px-2 py-1.5 bg-base-600 border border-base-500 rounded text-white text-sm text-right"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case BatchPurpose.Desmame:
        return (
          <div className="space-y-4">
            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3">
              <p className="text-purple-200 text-sm">
                Registre o peso de desmame de cada animal. O tipo de pesagem sera automaticamente marcado como <strong>"Desmame"</strong>.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Pesos de Desmame ({completionBatch.animalIds.length} animais)
              </label>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {completionBatch.animalIds.map(id => {
                  const animal = getAnimalById(id);
                  if (!animal) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 p-2 bg-base-700 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-medium">{animal.brinco}</span>
                        {animal.nome && <span className="text-gray-400 text-xs ml-1">({animal.nome})</span>}
                        <span className="text-gray-500 text-xs ml-2">Atual: {animal.pesoKg}kg</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={animalWeights[id] || ''}
                        onChange={(e) => setAnimalWeights(prev => ({ ...prev, [id]: e.target.value }))}
                        placeholder="kg"
                        className="w-24 px-2 py-1.5 bg-base-600 border border-base-500 rounded text-white text-sm text-right"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Deseja marcar o lote <strong>"{completionBatch.name}"</strong> como concluido?
            </p>
            <p className="text-gray-500 text-xs">{completionBatch.animalIds.length} animais no lote</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Lotes de Manejo</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
        >
          + Novo Lote
        </button>
      </div>

      {/* Lotes Ativos */}
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Lotes Ativos</h3>
        {activeBatches.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum lote ativo</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeBatches.map(batch => (
              <div
                key={batch.id}
                className="bg-base-800 rounded-lg p-4 border border-base-700 hover:border-brand-primary transition-colors cursor-pointer"
                onClick={() => setSelectedBatch(batch)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-white">{batch.name}</h4>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full text-white ${purposeColors[batch.purpose]}`}>
                      {batch.purpose}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-brand-primary">
                    {batch.animalIds.length}
                  </span>
                </div>

                {batch.description && (
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">{batch.description}</p>
                )}

                <div className="mt-3 pt-3 border-t border-base-700 flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    Criado em {new Date(batch.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openCompletionModal(batch);
                    }}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lotes Concluidos */}
      {completedBatches.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Recentemente Concluidos</h3>
          <div className="space-y-2">
            {completedBatches.map(batch => (
              <div
                key={batch.id}
                className="bg-base-800/50 rounded-lg px-4 py-2 flex justify-between items-center"
              >
                <div>
                  <span className="text-white">{batch.name}</span>
                  <span className="text-gray-500 text-sm ml-2">({batch.animalIds.length} animais)</span>
                </div>
                <span className="text-xs text-gray-500">
                  {batch.completedAt && new Date(batch.completedAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Criar Lote */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Criar Novo Lote"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome do Lote *</label>
            <input
              type="text"
              value={newBatch.name}
              onChange={(e) => setNewBatch(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Vacinacao Aftosa Marco/2025"
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Finalidade</label>
            <select
              value={newBatch.purpose}
              onChange={(e) => setNewBatch(prev => ({ ...prev, purpose: e.target.value as BatchPurpose }))}
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
            >
              {Object.values(BatchPurpose).map(purpose => (
                <option key={purpose} value={purpose}>{purpose}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Descricao</label>
            <textarea
              value={newBatch.description}
              onChange={(e) => setNewBatch(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Observacoes opcionais..."
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Animais ({newBatch.animalIds.length} selecionados)
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por brinco ou nome..."
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-1 bg-base-900 rounded-lg p-2">
              {filteredAnimals.map(animal => (
                <label
                  key={animal.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    newBatch.animalIds.includes(animal.id)
                      ? 'bg-brand-primary/20 border border-brand-primary'
                      : 'hover:bg-base-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={newBatch.animalIds.includes(animal.id)}
                    onChange={() => toggleAnimalInBatch(animal.id)}
                    className="rounded"
                  />
                  <span className="text-white text-sm">{animal.brinco}</span>
                  {animal.nome && <span className="text-gray-400 text-xs">({animal.nome})</span>}
                  <span className="text-gray-500 text-xs ml-auto">{animal.pesoKg}kg</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="flex-1 px-4 py-2 bg-base-700 text-white rounded-lg hover:bg-base-600"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateBatch}
              disabled={!newBatch.name.trim()}
              className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark disabled:opacity-50"
            >
              Criar Lote
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Detalhes do Lote */}
      <Modal
        isOpen={!!selectedBatch}
        onClose={() => setSelectedBatch(null)}
        title={selectedBatch?.name || 'Detalhes do Lote'}
      >
        {selectedBatch && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded-full text-white ${purposeColors[selectedBatch.purpose]}`}>
                {selectedBatch.purpose}
              </span>
              <span className="text-gray-400 text-sm">
                {selectedBatch.animalIds.length} animais
              </span>
            </div>

            {selectedBatch.description && (
              <p className="text-gray-300">{selectedBatch.description}</p>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">Animais no Lote</h4>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {selectedBatch.animalIds.map(id => {
                  const animal = getAnimalById(id);
                  if (!animal) return null;
                  return (
                    <div key={id} className="flex justify-between items-center p-2 bg-base-700 rounded">
                      <span className="text-white">{animal.brinco}</span>
                      <span className="text-gray-400 text-sm">{animal.pesoKg}kg</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  onDeleteBatch(selectedBatch.id);
                  setSelectedBatch(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
              {selectedBatch.status === 'active' && (
                <button
                  onClick={() => {
                    openCompletionModal(selectedBatch);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Marcar como Concluido
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Conclusao do Lote */}
      <Modal
        isOpen={!!completionBatch}
        onClose={() => setCompletionBatch(null)}
        title={getCompletionTitle()}
      >
        {completionBatch && (
          <div className="space-y-4">
            {renderCompletionContent()}

            <div className="flex gap-2 pt-4 border-t border-base-700">
              <button
                onClick={() => setCompletionBatch(null)}
                className="flex-1 px-4 py-2 bg-base-700 text-white rounded-lg hover:bg-base-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCompleteBatch}
                disabled={!isCompletionValid() || isCompleting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isCompleting ? 'Concluindo...' : 'Concluir Lote'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BatchManagement;
