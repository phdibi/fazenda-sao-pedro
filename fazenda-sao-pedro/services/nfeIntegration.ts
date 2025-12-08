import { Animal } from '../types';

export type NFeEnvironment = 'homologation' | 'production';
export type CertificateType = 'A1' | 'A3';

export interface NFeIntegrationConfig {
  environment: NFeEnvironment;
  issuerIE: string;
  issuerCpfCnpj: string;
  issuerMunicipality?: string;
  issuerUF?: string;
  certificateType: CertificateType;
  certificatePassword?: string;
  certificateAlias?: string;
  cscId: string;
  cscToken: string;
  backendEndpoint?: string;
  lastGtaNumber?: string;
}

export interface NFeDryRunResult {
  success: boolean;
  missing: string[];
  warnings: string[];
  payloadPreview: string;
  suggestedNextSteps: string[];
}

export const defaultNFeConfig: NFeIntegrationConfig = {
  environment: 'homologation',
  issuerIE: '',
  issuerCpfCnpj: '',
  issuerMunicipality: '',
  issuerUF: 'RS',
  certificateType: 'A1',
  certificatePassword: '',
  certificateAlias: '',
  cscId: '',
  cscToken: '',
  backendEndpoint: '',
  lastGtaNumber: '',
};

const sanitizeText = (value?: string) => (value || '').trim();

export const validateNFePrereqs = (config: NFeIntegrationConfig) => {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!sanitizeText(config.issuerCpfCnpj)) missing.push('CPF/CNPJ do emitente');
  if (!sanitizeText(config.issuerIE)) missing.push('Inscrição Estadual do emitente');
  if (!sanitizeText(config.cscId)) missing.push('ID do CSC (código de segurança)');
  if (!sanitizeText(config.cscToken)) missing.push('Token do CSC');
  if (!sanitizeText(config.issuerMunicipality)) missing.push('Município do emitente');
  if (!sanitizeText(config.issuerUF)) missing.push('UF do emitente');
  if (!sanitizeText(config.backendEndpoint))
    warnings.push('Defina o endpoint do backend que assina e envia a NF-e (SOAP/REST)');
  if (!sanitizeText(config.certificatePassword))
    warnings.push('Confirme a senha do certificado para evitar rejeições na assinatura');

  return { missing, warnings };
};

const buildAnimalSummary = (animals: Animal[]) => {
  if (!animals.length) return 'Nenhum animal cadastrado ainda.';
  const heads = animals.length;
  const averageWeight =
    animals.reduce((total, animal) => total + (animal.pesoKg || 0), 0) / heads;
  const firstAnimal = animals[0];

  return `${heads} cabeça(s), peso médio ${averageWeight.toFixed(0)} kg. Exemplo: ${
    firstAnimal.nome || firstAnimal.brinco
  } (${firstAnimal.raca}).`;
};

export const buildTestNFePayload = (
  config: NFeIntegrationConfig,
  animals: Animal[]
) => {
  const today = new Date().toISOString();
  const animalSummary = buildAnimalSummary(animals);
  const totalValue = animals.length * 1_000; // valor simbólico para dry-run

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe>
  <infNFe versao="4.00" Id="TESTE123456789">
    <ide>
      <mod>55</mod>
      <tpAmb>${config.environment === 'production' ? '1' : '2'}</tpAmb>
      <finNFe>1</finNFe>
      <natOp>Venda de bovinos</natOp>
      <cMunFG>${sanitizeText(config.issuerMunicipality) || '4300000'}</cMunFG>
      <UF>${sanitizeText(config.issuerUF) || 'RS'}</UF>
      <serie>1</serie>
      <nNF>1</nNF>
      <dhEmi>${today}</dhEmi>
      <tpEmis>1</tpEmis>
    </ide>
    <emit>
      <CNPJ>${sanitizeText(config.issuerCpfCnpj) || '00000000000000'}</CNPJ>
      <IE>${sanitizeText(config.issuerIE) || 'ISENTO'}</IE>
      <xNome>Produtor Rural</xNome>
      <enderEmit>
        <xMun>${sanitizeText(config.issuerMunicipality) || 'Município'}</xMun>
        <UF>${sanitizeText(config.issuerUF) || 'RS'}</UF>
      </enderEmit>
    </emit>
    <det nItem="1">
      <prod>
        <cProd>BOV001</cProd>
        <xProd>Bovinos vivos - ${animalSummary}</xProd>
        <CFOP>5107</CFOP>
        <uCom>CAB</uCom>
        <qCom>${animals.length || 1}</qCom>
        <vUnCom>${(totalValue / Math.max(animals.length, 1)).toFixed(2)}</vUnCom>
        <vProd>${totalValue.toFixed(2)}</vProd>
        <NCM>01022100</NCM>
      </prod>
      <imposto>
        <ICMS>
          <ICMS40>
            <orig>0</orig>
            <CST>40</CST>
          </ICMS40>
        </ICMS>
      </imposto>
    </det>
    <total>
      <ICMSTot>
        <vProd>${totalValue.toFixed(2)}</vProd>
        <vNF>${totalValue.toFixed(2)}</vNF>
      </ICMSTot>
    </total>
    <infAdic>
      <infCpl>Dry-run gerado pelo app: ${animalSummary}</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;
};

export const runIntegrationDryRun = (
  config: NFeIntegrationConfig,
  animals: Animal[]
): NFeDryRunResult => {
  const { missing, warnings } = validateNFePrereqs(config);
  const payloadPreview = buildTestNFePayload(config, animals);

  const suggestedNextSteps: string[] = [
    'Garanta que o backend consiga carregar o certificado A1/A3 para assinar o XML.',
    'Mantenha a numeração e série sincronizadas entre homologação e produção.',
    'Inclua GTA e dados do transporte na integração real quando houver movimentação de bovinos.',
  ];

  if (!config.backendEndpoint) {
    suggestedNextSteps.unshift('Aponte o backend SOAP/REST que enviará o XML à SEFAZ-RS.');
  }
  if (config.environment === 'production') {
    suggestedNextSteps.push('Revalide CSC e credenciais antes de enviar para produção.');
  }

  return {
    success: missing.length === 0,
    missing,
    warnings,
    payloadPreview,
    suggestedNextSteps,
  };
};
