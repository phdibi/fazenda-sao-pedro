import React, { useEffect, useMemo, useState } from 'react';
import { Animal } from '../types';
import {
  defaultNFeConfig,
  NFeDryRunResult,
  NFeIntegrationConfig,
  runIntegrationDryRun,
} from '../services/nfeIntegration';
import Spinner from './common/Spinner';

interface NFeIntegrationPanelProps {
  animals: Animal[];
}

const STORAGE_KEY = 'nfe.integration.config.v1';

const loadInitialConfig = (): NFeIntegrationConfig => {
  if (typeof window === 'undefined') return defaultNFeConfig;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultNFeConfig;
  try {
    const parsed = JSON.parse(stored);
    return { ...defaultNFeConfig, ...parsed } as NFeIntegrationConfig;
  } catch (error) {
    console.warn('Não foi possível ler a configuração de NF-e salva.', error);
    return defaultNFeConfig;
  }
};

const persistConfig = (config: NFeIntegrationConfig) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

const NFeIntegrationPanel = ({ animals }: NFeIntegrationPanelProps) => {
  const [config, setConfig] = useState<NFeIntegrationConfig>(loadInitialConfig);
  const [result, setResult] = useState<NFeDryRunResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    persistConfig(config);
  }, [config]);

  const animalSummary = useMemo(() => {
    if (!animals.length) return 'Cadastre ao menos um animal para preencher o XML.';
    const heads = animals.length;
    const averageWeight =
      animals.reduce((total, animal) => total + (animal.pesoKg || 0), 0) / heads;
    return `${heads} cabeças · ${averageWeight.toFixed(0)} kg (peso médio)`;
  }, [animals]);

  const handleChange = (field: keyof NFeIntegrationConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleTest = () => {
    setIsTesting(true);
    const dryRun = runIntegrationDryRun(config, animals);
    setResult(dryRun);
    setIsTesting(false);
  };

  return (
    <div className="bg-base-800 rounded-lg border border-base-700 shadow-lg p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Integração NF-e (RS)</h2>
          <p className="text-gray-400 text-sm">
            Use seu e-CPF e credenciamento para gerar XML de teste antes de enviar à SEFAZ-RS.
          </p>
        </div>
        <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-700/50">
          Checklist rápido
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Ambiente</label>
          <select
            value={config.environment}
            onChange={(e) => handleChange('environment', e.target.value)}
            className="bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
          >
            <option value="homologation">Homologação</option>
            <option value="production">Produção</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">CPF/CNPJ do emitente</label>
          <input
            value={config.issuerCpfCnpj}
            onChange={(e) => handleChange('issuerCpfCnpj', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="CPF do produtor (e-CPF)"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">Inscrição Estadual</label>
          <input
            value={config.issuerIE}
            onChange={(e) => handleChange('issuerIE', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="IE vinculada ao e-CPF"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">Município (cMunFG)</label>
          <input
            value={config.issuerMunicipality}
            onChange={(e) => handleChange('issuerMunicipality', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="Código IBGE do município"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">UF</label>
          <input
            value={config.issuerUF}
            onChange={(e) => handleChange('issuerUF', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="RS"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">Backend de envio (SOAP/REST)</label>
          <input
            value={config.backendEndpoint}
            onChange={(e) => handleChange('backendEndpoint', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="URL do serviço que assina e autoriza a NF-e"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">Tipo de certificado</label>
          <select
            value={config.certificateType}
            onChange={(e) => handleChange('certificateType', e.target.value)}
            className="bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
          >
            <option value="A1">A1 (arquivo)</option>
            <option value="A3">A3 (token/cartão)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">Senha do certificado</label>
          <input
            type="password"
            value={config.certificatePassword}
            onChange={(e) => handleChange('certificatePassword', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="Protege a assinatura do XML"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">Alias do certificado (opcional)</label>
          <input
            value={config.certificateAlias}
            onChange={(e) => handleChange('certificateAlias', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="Identificador no keystore"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">CSC ID</label>
          <input
            value={config.cscId}
            onChange={(e) => handleChange('cscId', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="Código de segurança do contribuinte"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">CSC Token</label>
          <input
            value={config.cscToken}
            onChange={(e) => handleChange('cscToken', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="Token fornecido pela SEFAZ-RS"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300">Última GTA usada (opcional)
          </label>
          <input
            value={config.lastGtaNumber}
            onChange={(e) => handleChange('lastGtaNumber', e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-md p-2 text-sm text-white"
            placeholder="Ajuda a referenciar o transporte"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-300">
        <p className="text-gray-400">Resumo do lote: {animalSummary}</p>
        <button
          onClick={handleTest}
          disabled={isTesting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-primary hover:bg-brand-primary-light text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isTesting ? <Spinner /> : 'Rodar checklist e gerar XML de teste'}
        </button>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-base-900/60 border border-base-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Checklist</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  result.success
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-700/50'
                    : 'bg-amber-500/10 text-amber-200 border-amber-600/50'
                }`}
              >
                {result.success ? 'Pronto para testar' : 'Ajustes pendentes'}
              </span>
            </div>

            {result.missing.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-600/50 rounded-md p-3 text-amber-100 text-sm space-y-1">
                <p className="font-semibold">Campos obrigatórios faltando:</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="bg-blue-500/5 border border-blue-600/50 rounded-md p-3 text-blue-100 text-sm space-y-1">
                <p className="font-semibold">Recomendações:</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-base-800/80 border border-base-700 rounded-md p-3 text-sm text-gray-200 space-y-1">
              <p className="font-semibold">Próximos passos</p>
              <ul className="list-disc list-inside space-y-1">
                {result.suggestedNextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-base-900/60 border border-base-700 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">XML de teste</h3>
              <span className="text-xs text-gray-400">Sem assinatura</span>
            </div>
            <div className="bg-base-800 border border-base-700 rounded-md p-3 max-h-80 overflow-auto">
              <pre className="text-xs text-gray-200 whitespace-pre-wrap break-all">
                {result.payloadPreview}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NFeIntegrationPanel;
