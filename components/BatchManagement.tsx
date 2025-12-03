import React, { useState, useMemo } from 'react';
import { ManagementBatch, BatchPurpose, Animal } from '../types';
import Modal from './common/Modal';

interface BatchManagementProps {
  batches: ManagementBatch[];
  animals: Animal[];
  onCreateBatch: (batch: Omit<ManagementBatch, 'id'>) => void;
  onUpdateBatch: (batchId: string, data: Partial<ManagementBatch>) => void;
  onDeleteBatch: (batchId: string) => void;
  onCompleteBatch: (batchId: string) => void;
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
                      onCompleteBatch(batch.id);
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

      {/* Lotes Concluídos */}
      {completedBatches.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Recentemente Concluídos</h3>
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
              placeholder="Ex: Vacinação Aftosa Março/2025"
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
            <label className="block text-sm text-gray-400 mb-1">Descrição</label>
            <textarea
              value={newBatch.description}
              onChange={(e) => setNewBatch(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Observações opcionais..."
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
              <button
                onClick={() => {
                  onCompleteBatch(selectedBatch.id);
                  setSelectedBatch(null);
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Marcar como Concluído
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BatchManagement;
