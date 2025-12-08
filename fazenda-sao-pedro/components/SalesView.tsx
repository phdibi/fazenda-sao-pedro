import React, { useState, useEffect, useMemo } from 'react';
import { Animal, AnimalStatus, Raca, Sexo } from '../types';
import {
  Sale,
  SaleStatus,
  Destinatario,
  ItemVenda,
  NFeConfig,
  NFeProvider,
  NFeResponse,
  CFOP_VENDA,
  NCM_BOVINOS,
  MUNICIPIOS_RS,
} from '../types/nfe.types';
import {
  emitirNFe,
  getNFeConfig,
  saveNFeConfig,
  testarConexaoNFe,
  validarCPF,
  validarCNPJ,
  formatarCpfCnpj,
  gerarDescricaoBovino,
} from '../services/nfeService';
import { Modal } from './common/Modal';
import { Spinner } from './common/Spinner';
import {
  PlusIcon,
  DocumentTextIcon,
  CogIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  CurrencyDollarIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
} from './common/Icons';

interface SalesViewProps {
  animals: Animal[];
  onUpdateAnimal: (animal: Animal) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({ animals, onUpdateAnimal }) => {
  // Estados principais
  const [sales, setSales] = useState<Sale[]>([]);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Estado da configuração NF-e
  const [nfeConfig, setNfeConfig] = useState<NFeConfig | null>(null);
  const [configTested, setConfigTested] = useState(false);

  // Carregar configuração salva
  useEffect(() => {
    const config = getNFeConfig();
    if (config) {
      setNfeConfig(config);
    }
  }, []);

  // Animais disponíveis para venda
  const animaisDisponiveis = useMemo(() => 
    animals.filter(a => a.status === AnimalStatus.Ativo),
    [animals]
  );

  // Criar nova venda
  const handleCreateSale = (sale: Sale) => {
    setSales(prev => [...prev, sale]);
    setShowNewSaleModal(false);
    setMessage({ type: 'success', text: 'Venda criada com sucesso!' });
  };

  // Emitir NF-e
  const handleEmitirNFe = async (sale: Sale) => {
    if (!nfeConfig) {
      setMessage({ type: 'error', text: 'Configure o serviço de NF-e primeiro.' });
      setShowConfigModal(true);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await emitirNFe(sale, nfeConfig);
      
      if (response.success) {
        // Atualizar venda com dados da NF-e
        const updatedSale: Sale = {
          ...sale,
          status: SaleStatus.NFeEmitida,
          nfe: {
            chave: response.chave!,
            numero: response.numero!,
            serie: response.serie!,
            dataEmissao: new Date(response.dataEmissao!),
            protocolo: response.protocolo!,
            xmlUrl: response.xmlUrl,
            danfeUrl: response.danfeUrl,
          },
          updatedAt: new Date(),
        };

        setSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
        
        // Marcar animais como vendidos
        sale.itens.forEach(item => {
          const animal = animals.find(a => a.id === item.animalId);
          if (animal) {
            onUpdateAnimal({ ...animal, status: AnimalStatus.Vendido });
          }
        });

        setMessage({ type: 'success', text: `NF-e ${response.numero} emitida com sucesso!` });
      } else {
        setSales(prev => prev.map(s => 
          s.id === sale.id 
            ? { ...s, status: SaleStatus.NFeRejeitada, updatedAt: new Date() } 
            : s
        ));
        setMessage({ type: 'error', text: response.mensagem });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao emitir NF-e. Verifique a conexão.' });
    } finally {
      setLoading(false);
    }
  };

  // Salvar configuração
  const handleSaveConfig = async (config: NFeConfig) => {
    setLoading(true);
    const result = await testarConexaoNFe(config);
    setLoading(false);
    
    if (result.success) {
      saveNFeConfig(config);
      setNfeConfig(config);
      setConfigTested(true);
      setMessage({ type: 'success', text: 'Configuração salva e testada com sucesso!' });
      setShowConfigModal(false);
    } else {
      setMessage({ type: 'error', text: `Falha no teste: ${result.mensagem}` });
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <CurrencyDollarIcon className="w-6 h-6" />
          Vendas e NF-e
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
              nfeConfig 
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
            }`}
          >
            <CogIcon className="w-5 h-5" />
            {nfeConfig ? 'NF-e Configurada' : 'Configurar NF-e'}
          </button>
          <button
            onClick={() => setShowNewSaleModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700"
          >
            <PlusIcon className="w-5 h-5" />
            Nova Venda
          </button>
        </div>
      </div>

      {/* Mensagem */}
      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <XCircleIcon className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Aviso se não configurado */}
      {!nfeConfig && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Configuração Necessária</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Para emitir NF-e, você precisa configurar uma API de terceiros (Webmania, Focus NFe ou eNotas).
                Clique em "Configurar NF-e" para começar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Vendas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-white">Vendas Recentes</h3>
        </div>
        
        {sales.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma venda registrada</p>
            <p className="text-sm">Clique em "Nova Venda" para começar</p>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {sales.map(sale => (
              <SaleRow 
                key={sale.id} 
                sale={sale} 
                onEmitirNFe={() => handleEmitirNFe(sale)}
                onView={() => setSelectedSale(sale)}
                loading={loading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Nova Venda */}
      {showNewSaleModal && (
        <NewSaleModal
          animais={animaisDisponiveis}
          onClose={() => setShowNewSaleModal(false)}
          onSave={handleCreateSale}
          nextNumber={sales.length + 1}
        />
      )}

      {/* Modal Configuração */}
      {showConfigModal && (
        <NFeConfigModal
          config={nfeConfig}
          onClose={() => setShowConfigModal(false)}
          onSave={handleSaveConfig}
          loading={loading}
        />
      )}

      {/* Modal Detalhes da Venda */}
      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
};

// ============================================
// COMPONENTES AUXILIARES
// ============================================

interface SaleRowProps {
  sale: Sale;
  onEmitirNFe: () => void;
  onView: () => void;
  loading: boolean;
}

const SaleRow: React.FC<SaleRowProps> = ({ sale, onEmitirNFe, onView, loading }) => {
  const statusColors: Record<SaleStatus, string> = {
    [SaleStatus.Rascunho]: 'bg-gray-100 text-gray-700',
    [SaleStatus.AguardandoNFe]: 'bg-yellow-100 text-yellow-700',
    [SaleStatus.NFeEmitida]: 'bg-green-100 text-green-700',
    [SaleStatus.NFeCancelada]: 'bg-red-100 text-red-700',
    [SaleStatus.NFeRejeitada]: 'bg-red-100 text-red-700',
    [SaleStatus.Concluida]: 'bg-blue-100 text-blue-700',
  };

  const statusLabels: Record<SaleStatus, string> = {
    [SaleStatus.Rascunho]: 'Rascunho',
    [SaleStatus.AguardandoNFe]: 'Aguardando NF-e',
    [SaleStatus.NFeEmitida]: 'NF-e Emitida',
    [SaleStatus.NFeCancelada]: 'Cancelada',
    [SaleStatus.NFeRejeitada]: 'Rejeitada',
    [SaleStatus.Concluida]: 'Concluída',
  };

  return (
    <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
      <div className="flex items-center gap-4">
        <div>
          <p className="font-medium text-gray-800 dark:text-white">
            Venda #{sale.numero}
          </p>
          <p className="text-sm text-gray-500">
            {sale.destinatario.nome} • {sale.itens.length} animal(is)
          </p>
          <p className="text-xs text-gray-400">
            {new Date(sale.data).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <span className="font-semibold text-gray-800 dark:text-white">
          {sale.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
        
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[sale.status]}`}>
          {statusLabels[sale.status]}
        </span>

        <div className="flex gap-2">
          {sale.status === SaleStatus.Rascunho && (
            <button
              onClick={onEmitirNFe}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Spinner size="sm" /> : 'Emitir NF-e'}
            </button>
          )}
          
          {sale.nfe?.danfeUrl && (
            <a
              href={sale.nfe.danfeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded text-sm flex items-center gap-1"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              DANFE
            </a>
          )}
          
          <button
            onClick={onView}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded text-sm"
          >
            Ver
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MODAL NOVA VENDA
// ============================================

interface NewSaleModalProps {
  animais: Animal[];
  onClose: () => void;
  onSave: (sale: Sale) => void;
  nextNumber: number;
}

const NewSaleModal: React.FC<NewSaleModalProps> = ({ animais, onClose, onSave, nextNumber }) => {
  const [step, setStep] = useState<'destinatario' | 'itens' | 'resumo'>('destinatario');
  const [destinatario, setDestinatario] = useState<Destinatario>({
    cpfCnpj: '',
    nome: '',
    endereco: {
      logradouro: '',
      numero: '',
      bairro: '',
      municipio: '',
      codigoMunicipio: '',
      uf: 'RS',
      cep: '',
    },
  });
  const [selectedAnimais, setSelectedAnimais] = useState<string[]>([]);
  const [valorPorCabeca, setValorPorCabeca] = useState<number>(0);
  const [valorPorKg, setValorPorKg] = useState<number>(0);
  const [tipoPreco, setTipoPreco] = useState<'cabeca' | 'kg'>('cabeca');
  const [observacoes, setObservacoes] = useState('');
  const [cfop, setCfop] = useState(CFOP_VENDA.PRODUTOR_RURAL);

  const animaisSelecionados = animais.filter(a => selectedAnimais.includes(a.id));
  
  const calcularValorTotal = () => {
    if (tipoPreco === 'cabeca') {
      return valorPorCabeca * selectedAnimais.length;
    } else {
      return animaisSelecionados.reduce((sum, a) => sum + (a.pesoKg * valorPorKg), 0);
    }
  };

  const criarItens = (): ItemVenda[] => {
    return animaisSelecionados.map(animal => ({
      animalId: animal.id,
      brinco: animal.brinco,
      descricao: gerarDescricaoBovino(animal.brinco, animal.raca, animal.sexo, animal.pesoKg),
      ncm: NCM_BOVINOS.VIVO,
      cfop,
      unidade: tipoPreco === 'kg' ? 'KG' : 'CAB',
      quantidade: tipoPreco === 'kg' ? animal.pesoKg : 1,
      valorUnitario: tipoPreco === 'kg' ? valorPorKg : valorPorCabeca,
      valorTotal: tipoPreco === 'kg' ? animal.pesoKg * valorPorKg : valorPorCabeca,
      pesoLiquido: animal.pesoKg,
      pesoBruto: animal.pesoKg,
    }));
  };

  const handleSalvar = () => {
    const sale: Sale = {
      id: `sale-${Date.now()}`,
      numero: nextNumber,
      data: new Date(),
      destinatario,
      itens: criarItens(),
      valorTotal: calcularValorTotal(),
      status: SaleStatus.Rascunho,
      observacoes,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user',
    };
    onSave(sale);
  };

  const cpfCnpjValido = destinatario.cpfCnpj.length === 11 
    ? validarCPF(destinatario.cpfCnpj)
    : destinatario.cpfCnpj.length === 14 
      ? validarCNPJ(destinatario.cpfCnpj)
      : false;

  return (
    <Modal title="Nova Venda" onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Steps */}
        <div className="flex border-b dark:border-gray-700">
          {(['destinatario', 'itens', 'resumo'] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`px-4 py-2 border-b-2 ${
                step === s 
                  ? 'border-green-600 text-green-600' 
                  : 'border-transparent text-gray-500'
              }`}
            >
              {i + 1}. {s === 'destinatario' ? 'Comprador' : s === 'itens' ? 'Animais' : 'Resumo'}
            </button>
          ))}
        </div>

        {/* Step 1: Destinatário */}
        {step === 'destinatario' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">CPF/CNPJ *</label>
                <input
                  type="text"
                  value={formatarCpfCnpj(destinatario.cpfCnpj)}
                  onChange={e => setDestinatario(d => ({ ...d, cpfCnpj: e.target.value.replace(/\D/g, '') }))}
                  className={`w-full p-2 border rounded dark:bg-gray-700 ${
                    destinatario.cpfCnpj && !cpfCnpjValido ? 'border-red-500' : ''
                  }`}
                  placeholder="000.000.000-00"
                  maxLength={18}
                />
                {destinatario.cpfCnpj && !cpfCnpjValido && (
                  <p className="text-xs text-red-500 mt-1">CPF/CNPJ inválido</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nome/Razão Social *</label>
                <input
                  type="text"
                  value={destinatario.nome}
                  onChange={e => setDestinatario(d => ({ ...d, nome: e.target.value }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">IE (opcional)</label>
                <input
                  type="text"
                  value={destinatario.ie || ''}
                  onChange={e => setDestinatario(d => ({ ...d, ie: e.target.value }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  placeholder="ISENTO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={destinatario.email || ''}
                  onChange={e => setDestinatario(d => ({ ...d, email: e.target.value }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                />
              </div>
            </div>

            <h4 className="font-medium mt-4">Endereço</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Logradouro *</label>
                <input
                  type="text"
                  value={destinatario.endereco.logradouro}
                  onChange={e => setDestinatario(d => ({ 
                    ...d, 
                    endereco: { ...d.endereco, logradouro: e.target.value }
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Número *</label>
                <input
                  type="text"
                  value={destinatario.endereco.numero}
                  onChange={e => setDestinatario(d => ({ 
                    ...d, 
                    endereco: { ...d.endereco, numero: e.target.value }
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bairro *</label>
                <input
                  type="text"
                  value={destinatario.endereco.bairro}
                  onChange={e => setDestinatario(d => ({ 
                    ...d, 
                    endereco: { ...d.endereco, bairro: e.target.value }
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Município *</label>
                <select
                  value={destinatario.endereco.municipio}
                  onChange={e => {
                    const mun = e.target.value;
                    const codigo = MUNICIPIOS_RS[mun as keyof typeof MUNICIPIOS_RS] || '';
                    setDestinatario(d => ({ 
                      ...d, 
                      endereco: { ...d.endereco, municipio: mun, codigoMunicipio: codigo }
                    }));
                  }}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                >
                  <option value="">Selecione...</option>
                  {Object.keys(MUNICIPIOS_RS).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CEP *</label>
                <input
                  type="text"
                  value={destinatario.endereco.cep}
                  onChange={e => setDestinatario(d => ({ 
                    ...d, 
                    endereco: { ...d.endereco, cep: e.target.value.replace(/\D/g, '') }
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  maxLength={8}
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setStep('itens')}
                disabled={!cpfCnpjValido || !destinatario.nome || !destinatario.endereco.municipio}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                Próximo
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Itens */}
        {step === 'itens' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Preço</label>
                <select
                  value={tipoPreco}
                  onChange={e => setTipoPreco(e.target.value as 'cabeca' | 'kg')}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                >
                  <option value="cabeca">Por Cabeça</option>
                  <option value="kg">Por Kg</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Valor {tipoPreco === 'cabeca' ? 'por Cabeça' : 'por Kg'} (R$)
                </label>
                <input
                  type="number"
                  value={tipoPreco === 'cabeca' ? valorPorCabeca : valorPorKg}
                  onChange={e => tipoPreco === 'cabeca' 
                    ? setValorPorCabeca(Number(e.target.value))
                    : setValorPorKg(Number(e.target.value))
                  }
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  min={0}
                  step={0.01}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CFOP</label>
                <select
                  value={cfop}
                  onChange={e => setCfop(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                >
                  <option value={CFOP_VENDA.PRODUTOR_RURAL}>5102 - Venda Produtor Rural (Interna)</option>
                  <option value={CFOP_VENDA.PRODUTOR_RURAL_INTER}>6102 - Venda Produtor Rural (Interestadual)</option>
                  <option value={CFOP_VENDA.INTERNA}>5101 - Venda Interna</option>
                  <option value={CFOP_VENDA.INTERESTADUAL}>6101 - Venda Interestadual</option>
                </select>
              </div>
            </div>

            <h4 className="font-medium">Selecione os Animais ({selectedAnimais.length} selecionados)</h4>
            <div className="max-h-64 overflow-y-auto border rounded dark:border-gray-700">
              {animais.map(animal => (
                <label
                  key={animal.id}
                  className={`flex items-center p-3 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    selectedAnimais.includes(animal.id) ? 'bg-green-50 dark:bg-green-900/20' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAnimais.includes(animal.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedAnimais(prev => [...prev, animal.id]);
                      } else {
                        setSelectedAnimais(prev => prev.filter(id => id !== animal.id));
                      }
                    }}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <span className="font-medium">{animal.brinco}</span>
                    {animal.nome && <span className="text-gray-500 ml-2">({animal.nome})</span>}
                  </div>
                  <div className="text-sm text-gray-500">
                    {animal.raca} • {animal.sexo} • {animal.pesoKg}kg
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-between mt-4">
              <button onClick={() => setStep('destinatario')} className="px-4 py-2 border rounded">
                Voltar
              </button>
              <button
                onClick={() => setStep('resumo')}
                disabled={selectedAnimais.length === 0 || (tipoPreco === 'cabeca' ? !valorPorCabeca : !valorPorKg)}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                Próximo
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Resumo */}
        {step === 'resumo' && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Comprador</h4>
              <p>{destinatario.nome}</p>
              <p className="text-sm text-gray-500">{formatarCpfCnpj(destinatario.cpfCnpj)}</p>
              <p className="text-sm text-gray-500">
                {destinatario.endereco.municipio}/{destinatario.endereco.uf}
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Itens ({selectedAnimais.length})</h4>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-600">
                  <tr>
                    <th className="p-2 text-left">Brinco</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-right">Peso</th>
                    <th className="p-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {criarItens().map(item => (
                    <tr key={item.animalId} className="border-b dark:border-gray-700">
                      <td className="p-2">{item.brinco}</td>
                      <td className="p-2 text-gray-500">{item.descricao}</td>
                      <td className="p-2 text-right">{item.pesoLiquido}kg</td>
                      <td className="p-2 text-right">
                        {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 dark:bg-gray-600 font-semibold">
                  <tr>
                    <td colSpan={3} className="p-2 text-right">Total:</td>
                    <td className="p-2 text-right">
                      {calcularValorTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                className="w-full p-2 border rounded dark:bg-gray-700"
                rows={3}
                placeholder="Informações adicionais para a NF-e..."
              />
            </div>

            <div className="flex justify-between mt-4">
              <button onClick={() => setStep('itens')} className="px-4 py-2 border rounded">
                Voltar
              </button>
              <button
                onClick={handleSalvar}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Criar Venda
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ============================================
// MODAL CONFIGURAÇÃO NF-e
// ============================================

interface NFeConfigModalProps {
  config: NFeConfig | null;
  onClose: () => void;
  onSave: (config: NFeConfig) => void;
  loading: boolean;
}

const NFeConfigModal: React.FC<NFeConfigModalProps> = ({ config, onClose, onSave, loading }) => {
  const [formData, setFormData] = useState<Partial<NFeConfig>>(config || {
    provider: 'focusnfe',
    ambiente: 'homologacao',
    apiKey: '',
    emitente: {
      cnpj: '',
      ie: '',
      razaoSocial: '',
      crt: 1,
      endereco: {
        logradouro: '',
        numero: '',
        bairro: '',
        municipio: '',
        codigoMunicipio: '',
        uf: 'RS',
        cep: '',
      },
    },
  });

  const handleSave = () => {
    if (!formData.apiKey || !formData.emitente?.cnpj) {
      alert('Preencha a API Key e CNPJ do emitente');
      return;
    }
    onSave(formData as NFeConfig);
  };

  return (
    <Modal title="Configurar Serviço de NF-e" onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Provider */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Provedor de NF-e</label>
            <select
              value={formData.provider}
              onChange={e => setFormData(f => ({ ...f, provider: e.target.value as NFeProvider }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
            >
              <option value="focusnfe">Focus NFe</option>
              <option value="webmania">Webmania</option>
              <option value="enotas">eNotas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ambiente</label>
            <select
              value={formData.ambiente}
              onChange={e => setFormData(f => ({ ...f, ambiente: e.target.value as 'homologacao' | 'producao' }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
            >
              <option value="homologacao">Homologação (Testes)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded text-sm">
          <p className="font-medium">Como obter as credenciais:</p>
          <ul className="list-disc list-inside mt-1 text-gray-600 dark:text-gray-300">
            <li><strong>Focus NFe:</strong> Cadastre-se em focusnfe.com.br</li>
            <li><strong>Webmania:</strong> Cadastre-se em webmaniabr.com</li>
            <li><strong>eNotas:</strong> Cadastre-se em enotas.com.br</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">API Key *</label>
            <input
              type="text"
              value={formData.apiKey || ''}
              onChange={e => setFormData(f => ({ ...f, apiKey: e.target.value }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
              placeholder="Sua chave de API"
            />
          </div>
          {formData.provider === 'webmania' && (
            <div>
              <label className="block text-sm font-medium mb-1">API Secret</label>
              <input
                type="text"
                value={formData.apiSecret || ''}
                onChange={e => setFormData(f => ({ ...f, apiSecret: e.target.value }))}
                className="w-full p-2 border rounded dark:bg-gray-700"
              />
            </div>
          )}
        </div>

        {/* Dados do Emitente */}
        <h4 className="font-medium mt-4 border-t pt-4">Dados do Emitente (Sua Fazenda)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">CNPJ *</label>
            <input
              type="text"
              value={formData.emitente?.cnpj || ''}
              onChange={e => setFormData(f => ({
                ...f,
                emitente: { ...f.emitente!, cnpj: e.target.value.replace(/\D/g, '') }
              }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
              maxLength={14}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Inscrição Estadual *</label>
            <input
              type="text"
              value={formData.emitente?.ie || ''}
              onChange={e => setFormData(f => ({
                ...f,
                emitente: { ...f.emitente!, ie: e.target.value }
              }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Razão Social *</label>
            <input
              type="text"
              value={formData.emitente?.razaoSocial || ''}
              onChange={e => setFormData(f => ({
                ...f,
                emitente: { ...f.emitente!, razaoSocial: e.target.value }
              }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">CRT (Regime Tributário)</label>
            <select
              value={formData.emitente?.crt || 1}
              onChange={e => setFormData(f => ({
                ...f,
                emitente: { ...f.emitente!, crt: Number(e.target.value) as 1 | 2 | 3 }
              }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
            >
              <option value={1}>1 - Simples Nacional</option>
              <option value={2}>2 - Simples Excesso</option>
              <option value={3}>3 - Regime Normal</option>
            </select>
          </div>
        </div>

        {/* Endereço */}
        <h5 className="font-medium text-sm mt-2">Endereço</h5>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <input
              type="text"
              placeholder="Logradouro"
              value={formData.emitente?.endereco?.logradouro || ''}
              onChange={e => setFormData(f => ({
                ...f,
                emitente: { 
                  ...f.emitente!, 
                  endereco: { ...f.emitente!.endereco, logradouro: e.target.value }
                }
              }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Número"
              value={formData.emitente?.endereco?.numero || ''}
              onChange={e => setFormData(f => ({
                ...f,
                emitente: { 
                  ...f.emitente!, 
                  endereco: { ...f.emitente!.endereco, numero: e.target.value }
                }
              }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Bairro"
              value={formData.emitente?.endereco?.bairro || ''}
              onChange={e => setFormData(f => ({
                ...f,
                emitente: { 
                  ...f.emitente!, 
                  endereco: { ...f.emitente!.endereco, bairro: e.target.value }
                }
              }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
            />
          </div>
          <div>
            <select
              value={formData.emitente?.endereco?.municipio || ''}
              onChange={e => {
                const mun = e.target.value;
                const codigo = MUNICIPIOS_RS[mun as keyof typeof MUNICIPIOS_RS] || '';
                setFormData(f => ({
                  ...f,
                  emitente: { 
                    ...f.emitente!, 
                    endereco: { ...f.emitente!.endereco, municipio: mun, codigoMunicipio: codigo }
                  }
                }));
              }}
              className="w-full p-2 border rounded dark:bg-gray-700"
            >
              <option value="">Município</option>
              {Object.keys(MUNICIPIOS_RS).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="text"
              placeholder="CEP"
              value={formData.emitente?.endereco?.cep || ''}
              onChange={e => setFormData(f => ({
                ...f,
                emitente: { 
                  ...f.emitente!, 
                  endereco: { ...f.emitente!.endereco, cep: e.target.value.replace(/\D/g, '') }
                }
              }))}
              className="w-full p-2 border rounded dark:bg-gray-700"
              maxLength={8}
            />
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Spinner size="sm" /> : null}
            Salvar e Testar
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ============================================
// MODAL DETALHES DA VENDA
// ============================================

interface SaleDetailModalProps {
  sale: Sale;
  onClose: () => void;
}

const SaleDetailModal: React.FC<SaleDetailModalProps> = ({ sale, onClose }) => {
  return (
    <Modal title={`Venda #${sale.numero}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Data</p>
            <p className="font-medium">{new Date(sale.data).toLocaleDateString('pt-BR')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium">{sale.status}</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-gray-500">Comprador</p>
            <p className="font-medium">{sale.destinatario.nome}</p>
            <p className="text-sm text-gray-500">{formatarCpfCnpj(sale.destinatario.cpfCnpj)}</p>
          </div>
        </div>

        {sale.nfe && (
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">NF-e Emitida</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Número:</span> {sale.nfe.numero}
              </div>
              <div>
                <span className="text-gray-500">Série:</span> {sale.nfe.serie}
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Chave:</span>
                <p className="font-mono text-xs break-all">{sale.nfe.chave}</p>
              </div>
              <div>
                <span className="text-gray-500">Protocolo:</span> {sale.nfe.protocolo}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {sale.nfe.danfeUrl && (
                <a
                  href={sale.nfe.danfeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  Baixar DANFE
                </a>
              )}
              {sale.nfe.xmlUrl && (
                <a
                  href={sale.nfe.xmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                >
                  Baixar XML
                </a>
              )}
            </div>
          </div>
        )}

        <div>
          <h4 className="font-semibold mb-2">Itens</h4>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="p-2 text-left">Brinco</th>
                <th className="p-2 text-right">Qtd</th>
                <th className="p-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {sale.itens.map(item => (
                <tr key={item.animalId} className="border-b dark:border-gray-700">
                  <td className="p-2">{item.brinco}</td>
                  <td className="p-2 text-right">{item.quantidade} {item.unidade}</td>
                  <td className="p-2 text-right">
                    {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-semibold">
              <tr>
                <td colSpan={2} className="p-2 text-right">Total:</td>
                <td className="p-2 text-right">
                  {sale.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {sale.observacoes && (
          <div>
            <p className="text-sm text-gray-500">Observações</p>
            <p>{sale.observacoes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SalesView;
