/**
 * Painel de Migração de Dados
 *
 * Permite ao usuário visualizar e executar migrações de dados pendentes.
 */

import React, { useState } from 'react';
import { useBirthWeightMigration } from '../hooks/useBirthWeightMigration';
import Spinner from './common/Spinner';

const DataMigrationPanel: React.FC = () => {
  const {
    preview,
    status,
    runMigration,
    hasPendingMigrations,
    eligibleCount,
  } = useBirthWeightMigration();

  const [showDetails, setShowDetails] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);

  const handleRunMigration = async () => {
    if (!confirmRun) {
      setConfirmRun(true);
      return;
    }

    await runMigration();
    setConfirmRun(false);
  };

  // Não mostra nada se não há migrações pendentes e nunca foi executado
  if (!hasPendingMigrations && !status.lastRun) {
    return null;
  }

  // Se acabou de migrar com sucesso e não há mais pendentes, mostra sucesso temporário
  const justCompleted = status.lastRun && status.successCount && status.successCount > 0 && !hasPendingMigrations;

  // Define o estilo do painel baseado no estado
  const panelStyle = justCompleted
    ? 'bg-emerald-900/20 border border-emerald-700/50'
    : 'bg-amber-900/20 border border-amber-700/50';

  const titleStyle = justCompleted ? 'text-emerald-300' : 'text-amber-300';
  const icon = justCompleted ? '✅' : '🔧';

  return (
    <div className={`${panelStyle} rounded-xl p-4 mb-6`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${titleStyle}`}>
            {justCompleted ? 'Dados Corrigidos' : 'Manutenção de Dados'}
          </h3>

          {justCompleted ? (
            <>
              <p className="text-sm text-emerald-400 mt-1">
                <strong>{status.successCount} animais</strong> foram corrigidos com sucesso!
                Os cálculos de DEP e KPIs agora refletirão os pesos de nascimento corretamente.
              </p>
              <p className="text-xs text-emerald-300/70 mt-1">
                Última execução: {status.lastRun?.toLocaleString('pt-BR')}
              </p>
            </>
          ) : hasPendingMigrations ? (
            <>
              <p className="text-sm text-amber-200/80 mt-1">
                Foram encontrados <strong>{eligibleCount} animais</strong> com peso
                cadastrado na data de nascimento, mas sem o tipo "Peso Nascimento" definido.
                Isso pode afetar os cálculos de DEP e KPIs.
              </p>

              {/* Botão para mostrar detalhes */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-amber-400 hover:text-amber-300 mt-2 underline"
              >
                {showDetails ? 'Ocultar detalhes' : 'Ver animais afetados'}
              </button>

              {/* Lista de animais afetados */}
              {showDetails && preview.details.length > 0 && (
                <div className="mt-3 max-h-60 overflow-y-auto bg-base-900/50 rounded-lg p-3">
                  <table className="w-full text-sm">
                    <thead className="text-gray-400 border-b border-base-700">
                      <tr>
                        <th className="text-left pb-2">Brinco</th>
                        <th className="text-left pb-2">Nome</th>
                        <th className="text-right pb-2">Peso</th>
                        <th className="text-right pb-2">Nasc.</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {preview.details.map((item, i) => (
                        <tr key={i} className="border-b border-base-800/50">
                          <td className="py-2 font-medium">{item.brinco}</td>
                          <td className="py-2">{item.nome || '-'}</td>
                          <td className="py-2 text-right">{item.peso} kg</td>
                          <td className="py-2 text-right">{item.dataNascimento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Barra de progresso durante execução */}
              {status.isRunning && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Spinner />
                    <span className="text-sm text-amber-200">
                      Migrando... {status.completed}/{status.total}
                    </span>
                  </div>
                  <div className="h-2 bg-base-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${status.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Botão de execução */}
              {!status.isRunning && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleRunMigration}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      confirmRun
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-amber-700/50 hover:bg-amber-600/50 text-amber-200'
                    }`}
                  >
                    {confirmRun ? '⚡ Confirmar Migração' : '🔄 Corrigir Dados'}
                  </button>

                  {confirmRun && (
                    <button
                      onClick={() => setConfirmRun(false)}
                      className="px-3 py-2 text-sm text-gray-400 hover:text-gray-300"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              )}

              {/* Erros */}
              {status.errors.length > 0 && (
                <div className="mt-3 p-2 bg-red-900/30 rounded-lg">
                  <p className="text-sm font-medium text-red-400">
                    {status.errors.length} erro(s) durante a migração:
                  </p>
                  <ul className="text-xs text-red-300 mt-1 list-disc list-inside">
                    {status.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DataMigrationPanel;
