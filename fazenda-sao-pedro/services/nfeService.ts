/**
 * Serviço de integração com APIs de NF-e de terceiros
 * Suporta: Webmania, Focus NFe, eNotas
 * 
 * IMPORTANTE: Este serviço é um FRONTEND stub.
 * Em produção, as chamadas devem passar por um BACKEND (Node.js/Firebase Functions)
 * para proteger as credenciais da API.
 */

import {
  NFeConfig,
  NFeRequest,
  NFeResponse,
  NFeItem,
  NFeProvider,
  Sale,
  ItemVenda,
  NCM_BOVINOS,
  CFOP_VENDA,
} from '../types/nfe.types';

// ============================================
// CONFIGURAÇÃO (armazenada no Firebase/localStorage)
// ============================================

const CONFIG_KEY = 'fazenda_nfe_config';

export const getNFeConfig = (): NFeConfig | null => {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

export const saveNFeConfig = (config: NFeConfig): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const clearNFeConfig = (): void => {
  localStorage.removeItem(CONFIG_KEY);
};

// ============================================
// CONVERSÃO DE DADOS
// ============================================

/**
 * Converte itens de venda para formato NF-e
 */
export const convertSaleItemsToNFe = (itens: ItemVenda[]): NFeItem[] => {
  return itens.map((item, index) => ({
    codigo: item.brinco || `ITEM-${index + 1}`,
    descricao: item.descricao || `Bovino - Brinco ${item.brinco}`,
    ncm: item.ncm || NCM_BOVINOS.VIVO,
    cfop: item.cfop || CFOP_VENDA.PRODUTOR_RURAL,
    unidade: item.unidade || 'CAB',
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    valorTotal: item.valorTotal,
    icms: {
      origem: 0,
      cst: '41', // Não tributado (produtor rural isento)
    },
  }));
};

// ============================================
// IMPLEMENTAÇÃO POR PROVIDER
// ============================================

/**
 * WEBMANIA API
 * Docs: https://webmaniabr.com/docs/nfe-api/
 */
const webmaniaEmitir = async (
  config: NFeConfig,
  request: NFeRequest
): Promise<NFeResponse> => {
  const endpoint = config.ambiente === 'producao'
    ? 'https://webmaniabr.com/api/1/nfe/emissao/'
    : 'https://webmaniabr.com/api/1/nfe/emissao/'; // Mesmo endpoint, muda config

  const payload = {
    ID: `${Date.now()}`,
    operacao: 1, // 1 = Saída
    natureza_operacao: request.naturezaOperacao || 'Venda de Gado Bovino',
    modelo: 1, // NF-e
    finalidade: 1, // Normal
    ambiente: config.ambiente === 'producao' ? 1 : 2,
    
    emitente: {
      cnpj: config.emitente.cnpj,
      razao_social: config.emitente.razaoSocial,
      nome_fantasia: config.emitente.nomeFantasia,
      ie: config.emitente.ie,
      crt: config.emitente.crt,
      endereco: {
        logradouro: config.emitente.endereco.logradouro,
        numero: config.emitente.endereco.numero,
        bairro: config.emitente.endereco.bairro,
        municipio: config.emitente.endereco.municipio,
        uf: config.emitente.endereco.uf,
        cep: config.emitente.endereco.cep,
        codigo_municipio: config.emitente.endereco.codigoMunicipio,
      },
    },

    destinatario: {
      cpf_cnpj: request.destinatario.cpfCnpj,
      nome_razao_social: request.destinatario.nome,
      ie: request.destinatario.ie || 'ISENTO',
      endereco: {
        logradouro: request.destinatario.endereco.logradouro,
        numero: request.destinatario.endereco.numero,
        complemento: request.destinatario.endereco.complemento,
        bairro: request.destinatario.endereco.bairro,
        municipio: request.destinatario.endereco.municipio,
        uf: request.destinatario.endereco.uf,
        cep: request.destinatario.endereco.cep,
        codigo_municipio: request.destinatario.endereco.codigoMunicipio,
      },
      email: request.destinatario.email,
    },

    produtos: request.itens.map((item, idx) => ({
      item: idx + 1,
      codigo: item.codigo,
      descricao: item.descricao,
      ncm: item.ncm,
      cfop: item.cfop,
      unidade: item.unidade,
      quantidade: item.quantidade,
      subtotal: item.valorUnitario,
      total: item.valorTotal,
      impostos: {
        icms: {
          origem: item.icms?.origem || 0,
          cst: item.icms?.cst || '41',
        },
      },
    })),

    pedido: {
      presenca: 9, // Operação não presencial
      modalidade_frete: 9, // Sem frete
      informacoes_complementares: request.informacoesAdicionais,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Consumer-Key': config.apiKey,
        'X-Consumer-Secret': config.apiSecret || '',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status === 'aprovado' || data.status === 'autorizado') {
      return {
        success: true,
        status: 'autorizada',
        mensagem: 'NF-e emitida com sucesso',
        chave: data.chave,
        numero: data.nfe,
        serie: data.serie,
        protocolo: data.recibo,
        dataEmissao: data.data_emissao,
        xmlUrl: data.xml,
        danfeUrl: data.danfe,
      };
    } else {
      return {
        success: false,
        status: 'rejeitada',
        mensagem: data.error?.message || data.motivo || 'Erro na emissão',
        codigoErro: data.error?.code,
        erros: data.error?.errors || [data.motivo],
      };
    }
  } catch (error) {
    return {
      success: false,
      status: 'erro',
      mensagem: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`,
    };
  }
};

/**
 * FOCUS NFe API
 * Docs: https://focusnfe.com.br/doc/
 */
const focusNFeEmitir = async (
  config: NFeConfig,
  request: NFeRequest
): Promise<NFeResponse> => {
  const baseUrl = config.ambiente === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';

  const ref = `REF-${Date.now()}`;

  const payload = {
    natureza_operacao: request.naturezaOperacao || 'Venda de Gado Bovino',
    forma_pagamento: 0, // À vista
    tipo_documento: 1, // Saída
    finalidade_emissao: 1, // Normal
    
    cnpj_emitente: config.emitente.cnpj,
    
    nome_destinatario: request.destinatario.nome,
    cpf_destinatario: request.destinatario.cpfCnpj.length === 11 
      ? request.destinatario.cpfCnpj : undefined,
    cnpj_destinatario: request.destinatario.cpfCnpj.length === 14 
      ? request.destinatario.cpfCnpj : undefined,
    inscricao_estadual_destinatario: request.destinatario.ie,
    logradouro_destinatario: request.destinatario.endereco.logradouro,
    numero_destinatario: request.destinatario.endereco.numero,
    bairro_destinatario: request.destinatario.endereco.bairro,
    municipio_destinatario: request.destinatario.endereco.municipio,
    uf_destinatario: request.destinatario.endereco.uf,
    cep_destinatario: request.destinatario.endereco.cep,
    codigo_municipio_destinatario: request.destinatario.endereco.codigoMunicipio,
    email_destinatario: request.destinatario.email,

    itens: request.itens.map((item, idx) => ({
      numero_item: idx + 1,
      codigo_produto: item.codigo,
      descricao: item.descricao,
      codigo_ncm: item.ncm,
      cfop: item.cfop,
      unidade_comercial: item.unidade,
      quantidade_comercial: item.quantidade,
      valor_unitario_comercial: item.valorUnitario,
      valor_bruto: item.valorTotal,
      icms_origem: item.icms?.origem || 0,
      icms_situacao_tributaria: item.icms?.cst || '41',
    })),

    informacoes_adicionais_contribuinte: request.informacoesAdicionais,
    modalidade_frete: 9,
  };

  try {
    const response = await fetch(`${baseUrl}/v2/nfe?ref=${ref}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(config.apiKey + ':')}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status === 'autorizado') {
      return {
        success: true,
        status: 'autorizada',
        mensagem: 'NF-e emitida com sucesso',
        chave: data.chave_nfe,
        numero: data.numero,
        serie: data.serie,
        protocolo: data.protocolo,
        dataEmissao: data.data_emissao,
        xmlUrl: data.caminho_xml_nota_fiscal,
        danfeUrl: data.caminho_danfe,
      };
    } else if (data.status === 'processando_autorizacao') {
      return {
        success: true,
        status: 'pendente',
        mensagem: 'NF-e em processamento. Consulte em alguns segundos.',
        chave: data.chave_nfe,
      };
    } else {
      return {
        success: false,
        status: 'rejeitada',
        mensagem: data.mensagem_sefaz || data.status,
        codigoErro: data.codigo_status?.toString(),
        erros: data.erros_validacao || [data.mensagem_sefaz],
      };
    }
  } catch (error) {
    return {
      success: false,
      status: 'erro',
      mensagem: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`,
    };
  }
};

/**
 * eNotas API
 * Docs: https://docs.enotas.com.br/
 */
const eNotasEmitir = async (
  config: NFeConfig,
  request: NFeRequest
): Promise<NFeResponse> => {
  const baseUrl = config.ambiente === 'producao'
    ? 'https://api.enotas.com.br'
    : 'https://api.sandbox.enotas.com.br';

  const payload = {
    tipo: 'NFeModelo55',
    idExterno: `${Date.now()}`,
    ambienteEmissao: config.ambiente === 'producao' ? 'Producao' : 'Homologacao',
    
    cliente: {
      tipoPessoa: request.destinatario.cpfCnpj.length === 11 ? 'F' : 'J',
      cpfCnpj: request.destinatario.cpfCnpj,
      nome: request.destinatario.nome,
      inscricaoEstadual: request.destinatario.ie,
      email: request.destinatario.email,
      telefone: request.destinatario.telefone,
      endereco: {
        logradouro: request.destinatario.endereco.logradouro,
        numero: request.destinatario.endereco.numero,
        complemento: request.destinatario.endereco.complemento,
        bairro: request.destinatario.endereco.bairro,
        cidade: request.destinatario.endereco.municipio,
        codigoIbgeCidade: request.destinatario.endereco.codigoMunicipio,
        uf: request.destinatario.endereco.uf,
        cep: request.destinatario.endereco.cep,
      },
    },

    itens: request.itens.map(item => ({
      codigo: item.codigo,
      descricao: item.descricao,
      ncm: item.ncm,
      cfop: item.cfop,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
    })),

    informacoesAdicionais: request.informacoesAdicionais,
  };

  try {
    const response = await fetch(`${baseUrl}/v2/empresas/${config.emitente.cnpj}/nf-e`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(config.apiKey + ':')}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status === 'Autorizada') {
      return {
        success: true,
        status: 'autorizada',
        mensagem: 'NF-e emitida com sucesso',
        chave: data.chaveAcesso,
        numero: data.numero,
        serie: data.serie,
        protocolo: data.protocolo,
        dataEmissao: data.dataEmissao,
        xmlUrl: data.linkDownloadXml,
        danfeUrl: data.linkDownloadPdf,
      };
    } else {
      return {
        success: false,
        status: data.status === 'Rejeitada' ? 'rejeitada' : 'erro',
        mensagem: data.motivoRejeicao || data.mensagem || 'Erro na emissão',
        erros: data.erros || [data.motivoRejeicao],
      };
    }
  } catch (error) {
    return {
      success: false,
      status: 'erro',
      mensagem: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`,
    };
  }
};

// ============================================
// API PRINCIPAL
// ============================================

/**
 * Emite uma NF-e usando o provider configurado
 */
export const emitirNFe = async (
  sale: Sale,
  config?: NFeConfig
): Promise<NFeResponse> => {
  const nfeConfig = config || getNFeConfig();
  
  if (!nfeConfig) {
    return {
      success: false,
      status: 'erro',
      mensagem: 'Configuração de NF-e não encontrada. Configure o serviço primeiro.',
    };
  }

  const request: NFeRequest = {
    operacao: 'emitir',
    naturezaOperacao: 'Venda de Gado Bovino',
    destinatario: sale.destinatario,
    itens: convertSaleItemsToNFe(sale.itens),
    informacoesAdicionais: sale.observacoes,
  };

  switch (nfeConfig.provider) {
    case 'webmania':
      return webmaniaEmitir(nfeConfig, request);
    case 'focusnfe':
      return focusNFeEmitir(nfeConfig, request);
    case 'enotas':
      return eNotasEmitir(nfeConfig, request);
    default:
      return {
        success: false,
        status: 'erro',
        mensagem: `Provider não suportado: ${nfeConfig.provider}`,
      };
  }
};

/**
 * Consulta status de uma NF-e
 */
export const consultarNFe = async (
  chaveNFe: string,
  config?: NFeConfig
): Promise<NFeResponse> => {
  const nfeConfig = config || getNFeConfig();
  
  if (!nfeConfig) {
    return {
      success: false,
      status: 'erro',
      mensagem: 'Configuração não encontrada',
    };
  }

  // Implementação simplificada - cada provider tem endpoint diferente
  // Em produção, implementar para cada provider
  
  return {
    success: false,
    status: 'erro',
    mensagem: 'Consulta não implementada para este provider. Use o painel do serviço.',
  };
};

/**
 * Cancela uma NF-e emitida
 */
export const cancelarNFe = async (
  chaveNFe: string,
  justificativa: string,
  config?: NFeConfig
): Promise<NFeResponse> => {
  const nfeConfig = config || getNFeConfig();
  
  if (!nfeConfig) {
    return {
      success: false,
      status: 'erro',
      mensagem: 'Configuração não encontrada',
    };
  }

  if (justificativa.length < 15) {
    return {
      success: false,
      status: 'erro',
      mensagem: 'Justificativa deve ter no mínimo 15 caracteres',
    };
  }

  // Implementação depende do provider
  // Por segurança, recomenda-se fazer via painel do serviço
  
  return {
    success: false,
    status: 'erro',
    mensagem: 'Cancelamento deve ser feito pelo painel do serviço de NF-e.',
  };
};

/**
 * Testa a conexão com o serviço de NF-e
 */
export const testarConexaoNFe = async (
  config: NFeConfig
): Promise<{ success: boolean; mensagem: string }> => {
  try {
    // Teste simples de autenticação
    switch (config.provider) {
      case 'webmania': {
        const response = await fetch('https://webmaniabr.com/api/1/nfe/sefaz/', {
          method: 'GET',
          headers: {
            'X-Consumer-Key': config.apiKey,
            'X-Consumer-Secret': config.apiSecret || '',
          },
        });
        const data = await response.json();
        return {
          success: response.ok,
          mensagem: response.ok ? 'Conexão OK - SEFAZ Online' : (data.error?.message || 'Falha na autenticação'),
        };
      }
      
      case 'focusnfe': {
        const baseUrl = config.ambiente === 'producao'
          ? 'https://api.focusnfe.com.br'
          : 'https://homologacao.focusnfe.com.br';
        const response = await fetch(`${baseUrl}/v2/sefaz`, {
          headers: {
            'Authorization': `Basic ${btoa(config.apiKey + ':')}`,
          },
        });
        return {
          success: response.ok,
          mensagem: response.ok ? 'Conexão OK' : 'Falha na autenticação',
        };
      }
      
      default:
        return {
          success: false,
          mensagem: 'Teste não disponível para este provider',
        };
    }
  } catch (error) {
    return {
      success: false,
      mensagem: `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`,
    };
  }
};

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Valida CNPJ
 */
export const validarCNPJ = (cnpj: string): boolean => {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  
  // Validação do dígito verificador
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  return resultado === parseInt(digitos.charAt(1));
};

/**
 * Valida CPF
 */
export const validarCPF = (cpf: string): boolean => {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf.charAt(10));
};

/**
 * Formata CPF/CNPJ para exibição
 */
export const formatarCpfCnpj = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '');
  if (numeros.length === 11) {
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (numeros.length === 14) {
    return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return valor;
};

/**
 * Gera descrição padrão para item de venda de bovino
 */
export const gerarDescricaoBovino = (
  brinco: string,
  raca?: string,
  sexo?: string,
  peso?: number
): string => {
  const partes = ['Bovino'];
  if (raca) partes.push(raca);
  if (sexo) partes.push(sexo);
  partes.push(`Brinco ${brinco}`);
  if (peso) partes.push(`${peso}kg`);
  return partes.join(' - ');
};
