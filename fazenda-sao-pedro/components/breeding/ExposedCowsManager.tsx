import React, { useState, useMemo } from 'react';
import { Animal } from '../../types';

interface ExposedCowsManagerProps {
  exposedCowIds: string[];
  eligibleCows: Animal[];
  allAnimals: Animal[];
  onUpdate: (cowIds: string[]) => void;
  onClose: () => void;
}

const ExposedCowsManager: React.FC<ExposedCowsManagerProps> = ({ exposedCowIds, eligibleCows, allAnimals, onUpdate, onClose }) => {
  const [search, setSearch] = useState('');
  const exposedSet = new Set(exposedCowIds);

  const exposedAnimals = useMemo(
    () => allAnimals.filter((a) => exposedSet.has(a.id)),
    [allAnimals, exposedCowIds]
  );

  const availableCows = useMemo(() => {
    const s = search.toLowerCase();
    return eligibleCows
      .filter((c) => !exposedSet.has(c.id))
      .filter(
        (c) =>
          !s || c.brinco.toLowerCase().includes(s) || c.nome?.toLowerCase().includes(s)
      )
      .slice(0, 50);
  }, [eligibleCows, exposedCowIds, search]);

  const handleAdd = (id: string) => {
    onUpdate([...exposedCowIds, id]);
  };
  const handleRemove = (id: string) => {
    onUpdate(exposedCowIds.filter((i) => i !== id));
  };
  const handleAddAll = () => {
    const allIds = new Set(exposedCowIds);
    eligibleCows.forEach((c) => allIds.add(c.id));
    onUpdate(Array.from(allIds));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8">
      <div
        className="bg-base-800 rounded-xl p-6 w-full max-w-lg my-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Vacas Expostas ({exposedCowIds.length})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {/* Lista das expostas */}
        <div>
          <h4 className="text-sm text-gray-400 mb-2">Vacas na estacao:</h4>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {exposedAnimals.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma vaca adicionada</p>
            ) : (
              exposedAnimals.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-base-700 rounded-full text-sm text-white"
                >
                  {a.brinco}
                  <button
                    onClick={() => handleRemove(a.id)}
                    className="text-gray-400 hover:text-red-400 ml-1"
                  >
                    &times;
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Adicionar novas */}
        <div className="border-t border-base-600 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm text-gray-400">Adicionar vacas:</h4>
            <button
              onClick={handleAddAll}
              className="text-xs text-brand-primary hover:text-brand-primary-light"
            >
              Selecionar todas elegiveis ({eligibleCows.length - exposedCowIds.length})
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por brinco ou nome..."
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {availableCows.map((cow) => (
              <div
                key={cow.id}
                className="flex items-center justify-between p-2 bg-base-700 rounded-lg hover:bg-base-600 cursor-pointer"
                onClick={() => handleAdd(cow.id)}
              >
                <span className="text-sm text-white">
                  {cow.brinco} - {cow.nome || 'Sem nome'}
                </span>
                <span className="text-xs text-brand-primary">+ Adicionar</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default ExposedCowsManager;
