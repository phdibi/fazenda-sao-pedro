// ============================================
// TIPOS PARA VENDAS E NF-e
// ============================================

export interface Destinatario {
  cpfCnpj: string;
  nome: string;
  ie?: string; // Inscrição Estadual
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    municipio: string;
    codigoMunicipio: string; // IBGE
    uf: string;
    cep: string;
  };
  email?: string;
  telefone?: string;
}

export interface ItemVenda {
  animalId: string;
  brinco: string;
  descricao: string;
  ncm: string; // 01022190 para bovinos vivos
  cfop: string; // 5101 venda interna, 6101 interestadual
  unidade: 'UN' | 'KG' | 'CAB'; // Unidade, Kg, Cabeça
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  pesoLiquido?: number;
  pesoBruto?: number;
}

export enum SaleStatus {
  Rascunho = 'rascunho',
  AguardandoNFe = 'aguardando_nfe',
  NFeEmitida = 'nfe_emitida',
  NFeCancelada = 'nfe_cancelada',
  NFeRejeitada = 'nfe_rejeitada',
  Concluida = 'concluida',
}

export interface Sale {
  id: string;
  numero: number; // Número sequencial da venda
  data: Date;
  destinatario: Destinatario;
  itens: ItemVenda[];
  valorTotal: number;
  status: SaleStatus;
  observacoes?: string;
  // Dados da NF-e após emissão
  nfe?: {
    chave: string;
    numero: number;
    serie: number;
    dataEmissao: Date;
    protocolo: string;
    xmlUrl?: string;
    danfeUrl?: string;
  };
  // GTA relacionada
  gtaNumero?: string;
  gtaUrl?: string;
  // Metadados
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================
// TIPOS PARA INTEGRAÇÃO COM API DE NF-e
// ============================================

export type NFeProvider = 'webmania' | 'focusnfe' | 'enotas';

export interface NFeConfig {
  provider: NFeProvider;
  apiKey: string;
  apiSecret?: string;
  ambiente: 'homologacao' | 'producao';
  // Dados do emitente (sua fazenda)
  emitente: {
    cnpj: string;
    ie: string;
    razaoSocial: string;
    nomeFantasia?: string;
    crt: 1 | 2 | 3; // 1=Simples, 2=Excesso, 3=Normal
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      municipio: string;
      codigoMunicipio: string;
      uf: string;
      cep: string;
    };
  };
  // Certificado digital (para alguns providers)
  certificado?: {
    arquivo?: string; // Base64 do .pfx
    senha?: string;
  };
}

export interface NFeRequest {
  operacao: 'emitir' | 'consultar' | 'cancelar' | 'cartacorrecao';
  naturezaOperacao: string;
  destinatario: Destinatario;
  itens: NFeItem[];
  informacoesAdicionais?: string;
  // Para cancelamento
  chaveNFe?: string;
  justificativa?: string;
}

export interface NFeItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  // Impostos (simplificado para produtor rural)
  icms?: {
    origem: 0 | 1 | 2; // 0=Nacional
    cst: string;
    aliquota?: number;
    baseCalculo?: number;
    valor?: number;
  };
}

export interface NFeResponse {
  success: boolean;
  status: 'autorizada' | 'rejeitada' | 'pendente' | 'cancelada' | 'erro';
  mensagem: string;
  // Dados da NF-e autorizada
  chave?: string;
  numero?: number;
  serie?: number;
  protocolo?: string;
  dataEmissao?: string;
  xmlUrl?: string;
  danfeUrl?: string;
  // Erros
  codigoErro?: string;
  erros?: string[];
}

// ============================================
// CONSTANTES PARA NF-e DE BOVINOS
// ============================================

export const NCM_BOVINOS = {
  VIVO: '01022190', // Bovinos vivos reprodutores
  VIVO_OUTROS: '01029090', // Outros bovinos vivos
  CARNE: '02011000', // Carne bovina
};

export const CFOP_VENDA = {
  INTERNA: '5101', // Venda dentro do estado
  INTERESTADUAL: '6101', // Venda para outro estado
  EXPORTACAO: '7101', // Exportação
  PRODUTOR_RURAL: '5102', // Venda por produtor rural
  PRODUTOR_RURAL_INTER: '6102', // Venda interestadual produtor rural
};

export const UNIDADES = {
  CABECA: 'CAB',
  UNIDADE: 'UN',
  QUILOGRAMA: 'KG',
  ARROBA: '@',
};

// Códigos IBGE de municípios do RS (principais)
export const MUNICIPIOS_RS = {
  'Alegrete': '4300406',
  'Bagé': '4301602',
  'Cachoeira do Sul': '4302709',
  'Dom Pedrito': '4306601',
  'Júlio de Castilhos': '4311403',
  'Lavras do Sul': '4311601',
  'Pelotas': '4314407',
  'Porto Alegre': '4314902',
  'Rosário do Sul': '4316006',
  'Santa Maria': '4316907',
  'Santana do Livramento': '4317103',
  'São Gabriel': '4318002',
  'Uruguaiana': '4322400',
};
