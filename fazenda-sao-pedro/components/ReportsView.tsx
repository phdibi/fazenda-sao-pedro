import React, { useState } from 'react';
import { generateComprehensiveReport } from '../services/geminiServiceOptimized';
import Spinner from './common/Spinner';
import { Animal, ComprehensiveReport } from '../types';
import { PrinterIcon, SparklesIcon } from './common/Icons';
import SanitaryReportDisplay from './SanitaryReportDisplay';
import ReproductiveReportDisplay from './ReproductiveReportDisplay';
import PerformanceComparisonView from './PerformanceComparisonView';
import TurnWeightReportDisplay from './TurnWeightReportDisplay';
import { WeatherCorrelationView } from './WeatherWidget';
import NFeIntegrationPanel from './NFeIntegrationPanel';

interface ReportsViewProps {
  animals: Animal[];
  focusNFe?: boolean;
  onNFeHandled?: () => void;
}

type TabName = 'sanitary' | 'reproductive' | 'performance' | 'comparatives' | 'turnWeight';

interface TabButtonProps {
  tabName: TabName;
  label: string;
  disabled?: boolean;
}

const ReportsView = ({ animals, focusNFe = false, onNFeHandled }: ReportsViewProps) => {
  const [reportData, setReportData] = useState<ComprehensiveReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    if (!focusNFe) return;
    const element = document.getElementById('nfe-integration-panel');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.classList.add('ring-2', 'ring-brand-primary');
      setTimeout(() => element.classList.remove('ring-2', 'ring-brand-primary'), 2000);
    }
    onNFeHandled?.();
  }, [focusNFe, onNFeHandled]);
  
  const today = new Date();
  const ninetyDaysAgo = new Date(new Date().setDate(today.getDate() - 90));
  
  const [startDate, setStartDate] = useState(ninetyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const [activeTab, setActiveTab] = useState<TabName>('sanitary');
  const hasReport = Boolean(reportData);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      setError('Por favor, selecione as datas de início e fim para gerar o relatório.');
      return;
    }

    setIsLoading(true);
    setError('');
    setReportData(null);

    try {
      const result = await generateComprehensiveReport(animals, {
        start: new Date(`${startDate}T00:00:00`),
        end: new Date(`${endDate}T23:59:59`)
      });
      setReportData(result);
    } catch (err) {
      setError('Falha ao gerar o relatório. Tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const TabButton = ({ tabName, label, disabled }: TabButtonProps) => (
    <button
      onClick={() => !disabled && setActiveTab(tabName)}
      disabled={disabled}
      className={[
        'w-full sm:w-auto text-center px-4 py-2 text-sm font-medium rounded-md transition-colors',
        activeTab === tabName ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-base-700/50',
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-white">Central de Relatórios</h1>
          {reportData && (
            <button
              onClick={() => window.print()}
              className="print-hide w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-base-700 hover:bg-base-600 transition-colors"
            >
              <PrinterIcon className="w-5 h-5 mr-2" />
              Imprimir / Exportar PDF
            </button>
          )}
        </div>

        <div id="nfe-integration-panel" className="mb-6 rounded-lg">
          <NFeIntegrationPanel animals={animals} />
        </div>

        {/* --- Controls --- */}
        <div className="bg-base-800 p-4 mb-6 rounded-lg shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between print-hide">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-medium text-gray-300">Período:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-base-700 border-base-600 rounded-md p-2 text-sm"/>
            <span className="text-gray-400">até</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-base-700 border-base-600 rounded-md p-2 text-sm"/>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="w-full md:w-auto inline-flex items-center justify-center px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-brand-primary-light disabled:bg-base-700 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-dark focus:ring-offset-base-900 transition-colors"
          >
            {isLoading ? <Spinner /> : <SparklesIcon className="w-5 h-5 mr-2" />}
            <span>Gerar Relatório</span>
          </button>
        </div>

        {/* --- Report Content --- */}
        <div className="mt-8">
          {isLoading && (
            <div className="flex flex-col items-center text-center text-gray-400 py-16">
              <Spinner />
              <p className="mt-2">Gemini está analisando os dados... Isso pode levar alguns segundos.</p>
            </div>
          )}

          {error && <p className="text-red-400 text-center py-16">{error}</p>}

          {!isLoading && !hasReport && (
            <div className="text-center text-gray-500 bg-base-800 p-16 rounded-lg">
              <p className="text-lg">Selecione um período e clique em "Gerar Relatório" para começar.</p>
              <p className="mt-2">A IA do Gemini irá processar os dados e fornecer insights valiosos.</p>
            </div>
          )}

          <div className="print-area">
            <div className="bg-base-800/50 p-3 rounded-lg flex flex-col sm:flex-row flex-wrap gap-2 print-hide mb-6">
              <TabButton tabName="sanitary" label="Análise Sanitária" />
              <TabButton tabName="reproductive" label="Reprodutivo" />
              <TabButton tabName="turnWeight" label="Peso de Virada" />
              <TabButton tabName="comparatives" label="Comparativos" />
              <TabButton tabName="performance" label="Desempenho (Em breve)" disabled />
            </div>

            {activeTab === 'comparatives' && (
              <div className="space-y-6">
                <PerformanceComparisonView animals={animals} onSelectAnimal={() => {}} />
                <WeatherCorrelationView animals={animals} />
              </div>
            )}

            {activeTab !== 'comparatives' && !hasReport && (
              <div className="text-center text-gray-500 bg-base-800 p-16 rounded-lg">
                <p className="text-lg">Gere um relatório para ver esta seção.</p>
                <p className="mt-2">Clique em "Gerar Relatório" para liberar a aba selecionada.</p>
              </div>
            )}

            {hasReport && activeTab === 'sanitary' && <SanitaryReportDisplay data={reportData!.sanitary} />}
            {hasReport && activeTab === 'reproductive' && <ReproductiveReportDisplay data={reportData!.reproductive} />}
            {hasReport && activeTab === 'turnWeight' && <TurnWeightReportDisplay data={reportData!.turnWeight} />}
          </div>
        </div>
      </div>
    );
  };

export default ReportsView;
