// ============================================
// MODAL DE MIGRAÇÃO FIV
// ============================================
// Permite ao usuário visualizar e corrigir animais FIV
// que foram cadastrados com a genealogia incorreta
// (maeNome apontando para receptora ao invés de doadora)

import React, { useState, useMemo } from 'react';
import Modal from './common/Modal';
import { Animal } from '../types';
import { analyzeFIVAnimals, prepareFIVFixes, generateMigrationReport } from '../services/fivMigration';
import { CheckIcon, ExclamationTriangleIcon } from './common/Icons';
import Spinner from './common/Spinner';

interface FIVMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  animals: Animal[];
  onUpdateAnimal: (animalId: string, updates: Partial<Animal>) => void;
}

const FIVMigrationModal: React.FC<FIVMigrationModalProps> = ({
  isOpen,
  onClose,
  animals,
  onUpdateAnimal
}) => {
  const [isFixing, setIsFixing] = useState(false);
  const [fixedCount, setFixedCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Analisa os animais FIV
  const analysis = useMemo(() => {
    const fivAnimals = animals.filter(a => a.isFIV);
    const { needsFix, alreadyCorrect, details } = analyzeFIVAnimals(animals);
    return {
      totalAnimals: animals.length,
      fivAnimals: fivAnimals.length,
      needsFix,
      alreadyCorrect,
      details
    };
  }, [animals]);

  const handleRunMigration = async () => {
    if (analysis.needsFix.length === 0) return;

    setIsFixing(true);
    setFixedCount(0);

    try {
      const fixes = prepareFIVFixes(analysis.needsFix, animals);

      for (const fix of fixes) {
        await onUpdateAnimal(fix.animalId, fix.updates);
        setFixedCount(prev => prev + 1);
        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setShowSuccess(true);
    } catch (error) {
      console.error('Erro durante migração FIV:', error);
      alert('Ocorreu um erro durante a migração. Verifique o console para detalhes.');
    } finally {
      setIsFixing(false);
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    setFixedCount(0);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Correção de Genealogia FIV">
      <div className="space-y-6 text-white">
        {/* Status Geral */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-base-700 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{analysis.totalAnimals}</p>
            <p className="text-xs text-gray-400">Total de Animais</p>
          </div>
          <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-300">{analysis.fivAnimals}</p>
            <p className="text-xs text-purple-400">Animais FIV</p>
          </div>
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-300">{analysis.alreadyCorrect.length}</p>
            <p className="text-xs text-green-400">Já Corretos</p>
          </div>
          <div className={`rounded-lg p-4 text-center ${analysis.needsFix.length > 0 ? 'bg-amber-900/30 border border-amber-700' : 'bg-base-700'}`}>
            <p className={`text-2xl font-bold ${analysis.needsFix.length > 0 ? 'text-amber-300' : 'text-gray-400'}`}>
              {analysis.needsFix.length}
            </p>
            <p className={`text-xs ${analysis.needsFix.length > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
              Precisam Correção
            </p>
          </div>
        </div>

        {/* Explicação */}
        <div className="bg-base-700/50 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-purple-300 mb-2">O que esta ferramenta faz?</h3>
          <p className="text-gray-300">
            Corrige animais FIV onde o campo <strong>"maeNome"</strong> estava apontando para a <strong>receptora</strong> (quem gestou)
            ao invés da <strong>doadora</strong> (mãe biológica/genética).
          </p>
          <p className="text-gray-400 mt-2">
            Após a correção, a árvore genealógica mostrará a doadora como mãe, garantindo que os cálculos de
            progênie, DEPs e KPIs considerem a genética correta.
          </p>
        </div>

        {/* Lista de animais que precisam correção */}
        {analysis.needsFix.length > 0 && !showSuccess && (
          <div className="bg-base-800 rounded-lg p-4">
            <h3 className="font-semibold text-amber-300 mb-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5" />
              Animais a serem corrigidos ({analysis.needsFix.length})
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {analysis.needsFix.map(animal => (
                <div key={animal.id} className="flex justify-between items-center bg-base-700/50 rounded p-2 text-sm">
                  <div>
                    <span className="font-semibold text-white">Brinco {animal.brinco}</span>
                    {animal.nome && <span className="text-gray-400 ml-2">({animal.nome})</span>}
                  </div>
                  <div className="text-xs text-right">
                    <p className="text-pink-400">Atual: {animal.maeNome || '(vazio)'}</p>
                    <p className="text-purple-400">Correto: {animal.maeBiologicaNome}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mensagem quando não há correções necessárias */}
        {analysis.needsFix.length === 0 && !showSuccess && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 text-center">
            <CheckIcon className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-300">Tudo certo!</h3>
            <p className="text-green-400 text-sm mt-2">
              Todos os animais FIV já estão com a genealogia correta.
            </p>
          </div>
        )}

        {/* Progresso durante a migração */}
        {isFixing && (
          <div className="bg-base-700 rounded-lg p-6 text-center">
            <Spinner />
            <p className="text-white mt-3">Corrigindo animais...</p>
            <p className="text-brand-primary-light text-lg font-bold mt-2">
              {fixedCount} de {analysis.needsFix.length}
            </p>
            <div className="w-full bg-base-600 rounded-full h-2 mt-3">
              <div
                className="bg-brand-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(fixedCount / analysis.needsFix.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Sucesso */}
        {showSuccess && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 text-center">
            <CheckIcon className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-300">Migração Concluída!</h3>
            <p className="text-green-400 text-sm mt-2">
              {fixedCount} animais foram corrigidos com sucesso.
            </p>
            <p className="text-gray-400 text-xs mt-3">
              A árvore genealógica agora mostrará a doadora (mãe biológica) como mãe para todos os animais FIV.
            </p>
          </div>
        )}

        {/* Avisos/Detalhes */}
        {analysis.details.length > 0 && !showSuccess && !isFixing && (
          <details className="bg-base-800 rounded-lg">
            <summary className="p-4 cursor-pointer text-gray-400 text-sm hover:text-gray-200">
              Ver detalhes técnicos ({analysis.details.length} itens)
            </summary>
            <div className="px-4 pb-4 text-xs space-y-1 max-h-32 overflow-y-auto">
              {analysis.details.map((detail, idx) => (
                <p key={idx} className="text-gray-500">
                  [{detail.brinco}] {detail.issue}
                </p>
              ))}
            </div>
          </details>
        )}

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3 pt-4 border-t border-base-700">
          <button
            onClick={handleClose}
            className="bg-base-700 hover:bg-base-600 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            {showSuccess ? 'Fechar' : 'Cancelar'}
          </button>
          {analysis.needsFix.length > 0 && !showSuccess && (
            <button
              onClick={handleRunMigration}
              disabled={isFixing}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isFixing ? (
                <>
                  <Spinner />
                  Corrigindo...
                </>
              ) : (
                <>
                  Corrigir {analysis.needsFix.length} Animais
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default FIVMigrationModal;
