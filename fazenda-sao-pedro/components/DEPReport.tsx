import React, { useMemo, useState } from 'react';
import { Animal, DEPReport as DEPReportType, DEPValues, Sexo } from '../types';
import {
  calculateAllDEPs,
  rankAnimalsByDEP,
  getEliteAnimals,
  getCullAnimals,
} from '../services/depCalculator';
import { useFarmData } from '../contexts/FarmContext';
import { REFERENCE_PERIOD_DISPLAY, getReferencePeriodStats } from '../utils/referencePeriod';

interface DEPReportProps {
  animals: Animal[];
  onSelectAnimal?: (animalId: string) => void;
  // Permite passar DEPs pré-calculados (do contexto centralizado)
  preCalculatedDEPs?: DEPReportType[];
}

// ============================================
// SUB-COMPONENTES
// ============================================

const RecommendationBadge: React.FC<{ recommendation: DEPReportType['recommendation'] }> = ({
  recommendation,
}) => {
  const config = {
    reprodutor_elite: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Reprodutor Elite' },
    reprodutor: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Reprodutor' },
    matriz_elite: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Matriz Elite' },
    matriz: { bg: 'bg-pink-500/20', text: 'text-pink-400', label: 'Matriz' },
    descarte: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Descarte' },
    indefinido: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Indefinido' },
  };

  const c = config[recommendation];

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

const DEPValue: React.FC<{
  value: number;
  accuracy: number;
  percentile: number;
  label: string;
  unit?: string;
}> = ({ value, accuracy, percentile, label, unit = 'kg' }) => {
  const isPositive = value > 0;
  const percentileColor =
    percentile >= 80
      ? 'text-emerald-400'
      : percentile >= 60
      ? 'text-blue-400'
      : percentile >= 40
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="bg-base-700 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}
          {value.toFixed(1)}
        </span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Acurácia:</span>
          <span className="text-white">{(accuracy * 100).toFixed(0)}%</span>
        </div>
        <div className={`font-medium ${percentileColor}`}>Top {100 - percentile}%</div>
      </div>
    </div>
  );
};

const AnimalDEPCard: React.FC<{
  report: DEPReportType;
  onClick?: () => void;
}> = ({ report, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-base-800 rounded-xl p-4 cursor-pointer hover:bg-base-750 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{report.brinco}</h3>
          {report.nome && <p className="text-sm text-gray-400">{report.nome}</p>}
          <p className="text-xs text-gray-500">
            {report.sexo} • {report.raca}
          </p>
        </div>
        <RecommendationBadge recommendation={report.recommendation} />
      </div>

      {/* DEPs */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <DEPValue
          value={report.dep.birthWeight}
          accuracy={report.accuracy.birthWeight}
          percentile={report.percentile.birthWeight}
          label="Peso Nascimento"
        />
        <DEPValue
          value={report.dep.weaningWeight}
          accuracy={report.accuracy.weaningWeight}
          percentile={report.percentile.weaningWeight}
          label="Peso Desmame"
        />
        <DEPValue
          value={report.dep.yearlingWeight}
          accuracy={report.accuracy.yearlingWeight}
          percentile={report.percentile.yearlingWeight}
          label="Peso Sobreano"
        />
        {report.sexo === 'Fêmea' && (
          <DEPValue
            value={report.dep.totalMaternal}
            accuracy={report.accuracy.totalMaternal}
            percentile={report.percentile.totalMaternal}
            label="Habilidade Materna"
          />
        )}
      </div>

      {/* DEPs de Carcaça (se disponíveis) */}
      {(report.dep.ribeyeArea !== undefined || report.dep.fatThickness !== undefined) && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Carcaça</div>
          <div className="grid grid-cols-2 gap-2">
            {report.dep.ribeyeArea !== undefined && (
              <DEPValue
                value={report.dep.ribeyeArea}
                accuracy={report.accuracy.ribeyeArea || 0}
                percentile={report.percentile.ribeyeArea ?? 50}
                label="AOL (Olho de Lombo)"
                unit="cm²"
              />
            )}
            {report.dep.fatThickness !== undefined && (
              <DEPValue
                value={report.dep.fatThickness}
                accuracy={report.accuracy.fatThickness || 0}
                percentile={report.percentile.fatThickness ?? 50}
                label="Espessura Gordura"
                unit="mm"
              />
            )}
          </div>
        </div>
      )}

      {/* DEPs de Fertilidade (se disponíveis) */}
      {(report.dep.scrotalCircumference !== undefined || report.dep.stayability !== undefined) && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Fertilidade</div>
          <div className="grid grid-cols-2 gap-2">
            {report.sexo === 'Macho' && report.dep.scrotalCircumference !== undefined && (
              <DEPValue
                value={report.dep.scrotalCircumference}
                accuracy={report.accuracy.scrotalCircumference || 0}
                percentile={report.percentile.scrotalCircumference ?? 50}
                label="Perímetro Escrotal"
                unit="cm"
              />
            )}
            {report.dep.stayability !== undefined && (
              <DEPValue
                value={report.dep.stayability}
                accuracy={report.accuracy.stayability || 0}
                percentile={report.percentile.stayability ?? 50}
                label="Permanência"
                unit="%"
              />
            )}
          </div>
        </div>
      )}

      {/* Fonte de dados */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Registros: {report.dataSource.ownRecords} próprios</span>
        <span>{report.dataSource.progenyRecords} progênie</span>
        <span>{report.dataSource.siblingsRecords} irmãos</span>
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const DEPReportComponent: React.FC<DEPReportProps> = ({ animals, onSelectAnimal, preCalculatedDEPs }) => {
  const [sortBy, setSortBy] = useState<keyof DEPValues>('weaningWeight');
  const [filterSex, setFilterSex] = useState<'all' | 'Macho' | 'Fêmea'>('all');
  const [showOnlyElite, setShowOnlyElite] = useState(false);
  const [showOnlyCull, setShowOnlyCull] = useState(false);

  // Tenta usar métricas centralizadas do contexto
  const farmContext = useFarmData();

  // Estatísticas do período de referência
  const referencePeriodStats = useMemo(() => getReferencePeriodStats(animals), [animals]);

  // Usa DEPs pré-calculados se disponíveis (props > contexto > cálculo local)
  const allReports = useMemo(() => {
    // 1. Prioridade: DEPs passados via props
    if (preCalculatedDEPs && preCalculatedDEPs.length > 0) {
      return preCalculatedDEPs;
    }

    // 2. Tenta usar do contexto centralizado
    const contextDEPs = farmContext?.metrics?.allDEPs;
    if (contextDEPs && contextDEPs.length > 0) {
      return contextDEPs;
    }

    // 3. Fallback: calcula localmente
    return calculateAllDEPs(animals);
  }, [animals, preCalculatedDEPs, farmContext?.metrics?.allDEPs]);

  // Estatísticas
  const stats = useMemo(() => {
    const elite = getEliteAnimals(allReports);
    const cull = getCullAnimals(allReports);

    return {
      total: allReports.length,
      eliteCount: elite.length,
      cullCount: cull.length,
      maleElite: elite.filter((r) => r.sexo === Sexo.Macho).length,
      femaleElite: elite.filter((r) => r.sexo === Sexo.Femea).length,
    };
  }, [allReports]);

  // Filtra e ordena
  const filteredReports = useMemo(() => {
    let reports = [...allReports];

    // Filtro por sexo
    if (filterSex !== 'all') {
      reports = reports.filter((r) => r.sexo === filterSex);
    }

    // Filtro elite/descarte
    if (showOnlyElite) {
      reports = getEliteAnimals(reports);
    } else if (showOnlyCull) {
      reports = getCullAnimals(reports);
    }

    // Ordenação
    reports = rankAnimalsByDEP(reports, sortBy);

    return reports;
  }, [allReports, filterSex, showOnlyElite, showOnlyCull, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Relatório de DEPs</h2>
        <p className="text-sm text-gray-400">
          Diferença Esperada na Progênie • Seleção Genética
        </p>
      </div>

      {/* Banner do Período de Referência */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-blue-400 text-lg">📊</span>
          <div>
            <p className="text-sm font-medium text-blue-300">Período de Referência Ativo</p>
            <p className="text-xs text-blue-200/80 mt-1">
              DEPs calculados apenas com animais nascidos a partir de {REFERENCE_PERIOD_DISPLAY}.
              Isso corrige o viés de seleção dos dados históricos.
            </p>
            <p className="text-xs text-blue-400 mt-1">
              {referencePeriodStats.inPeriod} animais no período ({referencePeriodStats.excluded} excluídos)
            </p>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-base-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-gray-400">Total Avaliados</div>
        </div>
        <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.eliteCount}</div>
          <div className="text-xs text-gray-400">Elite</div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.maleElite}</div>
          <div className="text-xs text-gray-400">Reprodutores Elite</div>
        </div>
        <div className="bg-purple-500/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.femaleElite}</div>
          <div className="text-xs text-gray-400">Matrizes Elite</div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{stats.cullCount}</div>
          <div className="text-xs text-gray-400">Para Descarte</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-base-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Ordenar por */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ordenar por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as keyof DEPValues)}
              className="bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="birthWeight">Peso Nascimento</option>
              <option value="weaningWeight">Peso Desmame</option>
              <option value="yearlingWeight">Peso Sobreano</option>
              <option value="totalMaternal">Habilidade Materna</option>
              <option value="ribeyeArea">AOL (Olho de Lombo)</option>
              <option value="fatThickness">Espessura de Gordura</option>
              <option value="scrotalCircumference">Perímetro Escrotal</option>
              <option value="stayability">Permanência (Stayability)</option>
            </select>
          </div>

          {/* Filtrar por sexo */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sexo</label>
            <div className="flex gap-1">
              {(['all', 'Macho', 'Fêmea'] as const).map((sex) => (
                <button
                  key={sex}
                  onClick={() => setFilterSex(sex)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterSex === sex
                      ? 'bg-brand-primary text-white'
                      : 'bg-base-700 text-gray-300 hover:bg-base-600'
                  }`}
                >
                  {sex === 'all' ? 'Todos' : sex === 'Macho' ? 'Machos' : 'Fêmeas'}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros rápidos */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Filtro rápido</label>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setShowOnlyElite(!showOnlyElite);
                  setShowOnlyCull(false);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showOnlyElite
                    ? 'bg-emerald-600 text-white'
                    : 'bg-base-700 text-gray-300 hover:bg-base-600'
                }`}
              >
                Elite
              </button>
              <button
                onClick={() => {
                  setShowOnlyCull(!showOnlyCull);
                  setShowOnlyElite(false);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showOnlyCull
                    ? 'bg-red-600 text-white'
                    : 'bg-base-700 text-gray-300 hover:bg-base-600'
                }`}
              >
                Descarte
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de animais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map((report) => (
          <AnimalDEPCard
            key={report.animalId}
            report={report}
            onClick={() => onSelectAnimal?.(report.animalId)}
          />
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-gray-400">Nenhum animal encontrado com os filtros aplicados</p>
        </div>
      )}

      {/* Legenda */}
      <div className="bg-base-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Interpretação dos DEPs</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
          <div>
            <p className="mb-2">
              <strong className="text-white">DEP (Diferença Esperada na Progênie):</strong> Predição
              de quanto os filhos de um animal devem diferir da média da raça.
            </p>
            <p className="mb-2">
              <strong className="text-white">Acurácia:</strong> Confiabilidade do DEP. Aumenta com
              mais informações (próprias, de progênie, de parentes).
            </p>
            <p>
              <strong className="text-white">Percentil:</strong> Posição do animal no ranking da
              raça. Top 20% são os 20% melhores.
            </p>
          </div>
          <div>
            <p className="mb-2">
              <strong className="text-white">Habilidade Materna:</strong> Capacidade da fêmea de
              criar bezerros mais pesados ao desmame.
            </p>
            <p className="mb-2">
              <strong className="text-white">AOL (Área de Olho de Lombo):</strong> Medida da musculosidade
              do animal (cm²). Medido por ultrassom entre a 12ª e 13ª costela.
            </p>
            <p className="mb-2">
              <strong className="text-white">Espessura de Gordura (EGS):</strong> Gordura subcutânea (mm).
              Indica acabamento de carcaça. Ideal para abate: 3-6 mm.
            </p>
            <p className="mb-2">
              <strong className="text-white">Perímetro Escrotal (PE):</strong> Circunferência escrotal (cm).
              Correlacionado com fertilidade e precocidade sexual. Apenas machos.
            </p>
            <p>
              <strong className="text-white">Permanência (Stayability):</strong> Probabilidade de uma
              matriz permanecer produtiva no rebanho até 6+ anos. Calculada automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DEPReportComponent;
