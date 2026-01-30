import { Animal, FilteredStats, ManagementArea, BreedingSeason } from '../types';

// ============================================
// CSV EXPORT
// ============================================

const escapeCSV = (value: any): string => {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportToCSV = (
  data: Record<string, any>[],
  headers: Record<string, string>,
  filename: string
) => {
  const headerKeys = Object.keys(headers);
  const headerValues = Object.values(headers);

  const csvRows = [headerValues.join(',')];

  for (const row of data) {
    const values = headerKeys.map(key => escapeCSV(row[key]));
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });

  downloadBlob(blob, filename);
};

// ============================================
// PDF EXPORT
// ============================================

interface PDFExportOptions {
  title: string;
  subtitle?: string;
  includeStats?: boolean;
  includeDate?: boolean;
}

const formatDateBR = (date: Date | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pt-BR');
};


const generatePDFContent = (
  animals: Animal[],
  stats: FilteredStats,
  areas: ManagementArea[],
  options: PDFExportOptions
): string => {
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const getAreaName = (areaId?: string) => {
    if (!areaId) return 'Sem área';
    return areas.find(a => a.id === areaId)?.name || 'Área desconhecida';
  };

  const styles = `
    <style>
      @page { size: A4; margin: 1.5cm; }
      * { box-sizing: border-box; }
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 10px;
        line-height: 1.4;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .header {
        text-align: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #381b18;
      }
      .header h1 {
        color: #381b18;
        margin: 0 0 5px 0;
        font-size: 22px;
      }
      .header .subtitle {
        color: #666;
        font-size: 12px;
        margin: 5px 0;
      }
      .header .date {
        color: #999;
        font-size: 10px;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      .stat-card {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 6px;
        text-align: center;
        border: 1px solid #e9ecef;
      }
      .stat-card .value {
        font-size: 18px;
        font-weight: bold;
        color: #381b18;
      }
      .stat-card .label {
        font-size: 9px;
        color: #666;
        margin-top: 3px;
      }
      .section-title {
        font-size: 14px;
        font-weight: bold;
        color: #381b18;
        margin: 20px 0 10px 0;
        padding-bottom: 5px;
        border-bottom: 1px solid #ddd;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 9px;
      }
      th {
        background: #381b18;
        color: white;
        padding: 8px 6px;
        text-align: left;
        font-weight: 600;
      }
      td {
        padding: 6px;
        border-bottom: 1px solid #eee;
      }
      tr:nth-child(even) { background: #f9f9f9; }
      tr:hover { background: #f0f0f0; }
      .status-ativo { color: #28a745; font-weight: bold; }
      .status-vendido { color: #ffc107; font-weight: bold; }
      .status-obito { color: #dc3545; font-weight: bold; }
      .footer {
        margin-top: 30px;
        padding-top: 15px;
        border-top: 1px solid #ddd;
        font-size: 8px;
        color: #999;
        text-align: center;
      }
      .distribution-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        margin-bottom: 20px;
      }
      .distribution-card {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #e9ecef;
      }
      .distribution-card h4 {
        margin: 0 0 10px 0;
        font-size: 11px;
        color: #381b18;
      }
      .distribution-item {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        border-bottom: 1px dotted #ddd;
      }
      .distribution-item:last-child { border: none; }
      @media print {
        .no-print { display: none; }
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>
  `;

  let html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${options.title}</title>
      ${styles}
    </head>
    <body>
      <div class="header">
        <h1>${options.title}</h1>
        ${options.subtitle ? `<div class="subtitle">${options.subtitle}</div>` : ''}
        ${options.includeDate ? `<div class="date">Gerado em: ${currentDate}</div>` : ''}
      </div>
  `;

  if (options.includeStats) {
    html += `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${stats.totalAnimals}</div>
          <div class="label">Total de Animais</div>
        </div>
        <div class="stat-card">
          <div class="value">${stats.activeCount}</div>
          <div class="label">Ativos</div>
        </div>
        <div class="stat-card">
          <div class="value">${stats.averageWeight.toFixed(1)} kg</div>
          <div class="label">Peso Médio</div>
        </div>
        <div class="stat-card">
          <div class="value">${stats.maleCount}M / ${stats.femaleCount}F</div>
          <div class="label">Machos / Fêmeas</div>
        </div>
      </div>

      <div class="distribution-grid">
        <div class="distribution-card">
          <h4>Distribuição por Raça</h4>
          ${Object.entries(stats.breedDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([raca, count]) => `
              <div class="distribution-item">
                <span>${raca}</span>
                <strong>${count}</strong>
              </div>
            `).join('')}
        </div>
        <div class="distribution-card">
          <h4>Distribuição por Idade</h4>
          <div class="distribution-item">
            <span>Bezerros (0-6m)</span>
            <strong>${stats.ageDistribution.bezerros}</strong>
          </div>
          <div class="distribution-item">
            <span>Jovens (6-12m)</span>
            <strong>${stats.ageDistribution.jovens}</strong>
          </div>
          <div class="distribution-item">
            <span>Novilhos (12-24m)</span>
            <strong>${stats.ageDistribution.novilhos}</strong>
          </div>
          <div class="distribution-item">
            <span>Adultos (24m+)</span>
            <strong>${stats.ageDistribution.adultos}</strong>
          </div>
        </div>
      </div>
    `;
  }

  html += `
    <div class="section-title">Lista de Animais (${animals.length})</div>
    <table>
      <thead>
        <tr>
          <th>Brinco</th>
          <th>Nome</th>
          <th>Raça</th>
          <th>Sexo</th>
          <th>Nascimento</th>
          <th>Peso (kg)</th>
          <th>Status</th>
          <th>Área</th>
          <th>Mãe</th>
          <th>Pai</th>
        </tr>
      </thead>
      <tbody>
  `;

  animals.forEach(animal => {
    const statusClass = animal.status === 'Ativo' ? 'status-ativo'
      : animal.status === 'Vendido' ? 'status-vendido'
      : 'status-obito';

    html += `
      <tr>
        <td><strong>${animal.brinco}</strong></td>
        <td>${animal.nome || '-'}</td>
        <td>${animal.raca}</td>
        <td>${animal.sexo}</td>
        <td>${formatDateBR(animal.dataNascimento)}</td>
        <td>${animal.pesoKg}</td>
        <td class="${statusClass}">${animal.status}</td>
        <td>${getAreaName(animal.managementAreaId)}</td>
        <td>${animal.maeNome || '-'}</td>
        <td>${animal.paiNome || '-'}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <div class="footer">
      Fazenda+ - Sistema de Gestão de Rebanho • Relatório gerado automaticamente
    </div>
    </body>
    </html>
  `;

  return html;
};

export const exportToPDF = (
  animals: Animal[],
  stats: FilteredStats,
  areas: ManagementArea[],
  options: PDFExportOptions
) => {
  const htmlContent = generatePDFContent(animals, stats, areas, options);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup bloqueado! Permita popups para gerar o PDF.');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
};

export const exportAsHTML = (
  animals: Animal[],
  stats: FilteredStats,
  areas: ManagementArea[],
  options: PDFExportOptions
) => {
  const htmlContent = generatePDFContent(animals, stats, areas, options);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const filename = `${options.title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
  downloadBlob(blob, filename);
};


// ============================================
// UTILITY FUNCTIONS
// ============================================

const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const prepareAnimalDataForExport = (animals: Animal[]) => {
  return animals.map(animal => ({
    brinco: animal.brinco,
    nome: animal.nome || '',
    raca: animal.raca,
    sexo: animal.sexo,
    dataNascimento: animal.dataNascimento ? formatDateBR(animal.dataNascimento) : '',
    pesoKg: animal.pesoKg,
    status: animal.status,
    paiNome: animal.paiNome || '',
    maeNome: animal.maeNome || '',
    numMedicacoes: animal.historicoSanitario.length,
    numPesagens: animal.historicoPesagens.length,
    numPrenhez: animal.historicoPrenhez?.length || 0,
    numAbortos: animal.historicoAborto?.length || 0,
    numProgenie: animal.historicoProgenie?.length || 0,
  }));
};

export const CSV_HEADERS = {
  brinco: 'Brinco',
  nome: 'Nome',
  raca: 'Raça',
  sexo: 'Sexo',
  dataNascimento: 'Data de Nascimento',
  pesoKg: 'Peso Atual (kg)',
  status: 'Status',
  paiNome: 'Pai',
  maeNome: 'Mãe',
  numMedicacoes: 'Nº Medicações',
  numPesagens: 'Nº Pesagens',
  numPrenhez: 'Nº Prenhez',
  numAbortos: 'Nº Abortos',
  numProgenie: 'Nº Crias',
};

// ============================================
// ESTAÇÃO DE MONTA - EXPORT
// ============================================

const getCoverageTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    natural: 'Monta Natural',
    ia: 'Inseminação Artificial',
    iatf: 'IATF',
    fiv: 'FIV (Fertilização In Vitro)',
  };
  return labels[type] || type;
};

const getPregnancyResultLabel = (result?: string): string => {
  const labels: Record<string, string> = {
    positive: 'Prenhe',
    negative: 'Vazia',
    pending: 'Aguardando',
  };
  return result ? labels[result] || result : 'Aguardando';
};

export const BREEDING_SEASON_HEADERS: Record<string, string> = {
  cowBrinco: 'Brinco Vaca',
  coverageDate: 'Data Cobertura',
  coverageType: 'Tipo',
  sire: 'Touro/Sêmen',
  donorInfo: 'Doadora (FIV)',
  recipientInfo: 'Receptora (FIV)',
  technician: 'Técnico',
  pregnancyResult: 'Resultado',
  pregnancyCheckDate: 'Data Diagnóstico',
  expectedCalvingDate: 'Previsão Parto',
  notes: 'Observações',
};

export interface BreedingSeasonExportData {
  cowBrinco: string;
  coverageDate: string;
  coverageType: string;
  sire: string;
  donorInfo: string;
  recipientInfo: string;
  technician: string;
  pregnancyResult: string;
  pregnancyCheckDate: string;
  expectedCalvingDate: string;
  notes: string;
}

export const prepareBreedingSeasonDataForExport = (
  season: BreedingSeason,
  animals: Animal[]
): BreedingSeasonExportData[] => {
  const getAnimalName = (id?: string, brinco?: string): string => {
    if (id) {
      const animal = animals.find(a => a.id === id);
      if (animal) {
        return animal.nome ? `${animal.brinco} (${animal.nome})` : animal.brinco;
      }
    }
    return brinco || '';
  };

  return (season.coverageRecords || []).map(coverage => {
    // Para FIV: mostra doadora e receptora separadamente
    const isFIV = coverage.type === 'fiv';
    const donorInfo = isFIV && coverage.donorCowBrinco
      ? getAnimalName(coverage.donorCowId, coverage.donorCowBrinco)
      : '';
    const recipientInfo = isFIV ? getAnimalName(coverage.cowId, coverage.cowBrinco) : '';

    // Nome do touro/sêmen (suporta múltiplos touros na monta natural)
    let sire = '';
    if (coverage.type === 'natural' && coverage.bulls && coverage.bulls.length > 0) {
      if (coverage.confirmedSireId) {
        sire = coverage.confirmedSireBrinco || 'Confirmado';
      } else if (coverage.bulls.length === 1) {
        sire = getAnimalName(coverage.bulls[0].bullId, coverage.bulls[0].bullBrinco);
      } else {
        sire = coverage.bulls.map(b => b.bullBrinco).join(' / ') + ' (pendente)';
      }
    } else if (coverage.bullBrinco) {
      sire = getAnimalName(coverage.bullId, coverage.bullBrinco);
    } else {
      sire = coverage.semenCode || '';
    }

    return {
      cowBrinco: isFIV ? `${coverage.cowBrinco} (Receptora)` : coverage.cowBrinco,
      coverageDate: coverage.date ? formatDateBR(new Date(coverage.date)) : '',
      coverageType: getCoverageTypeLabel(coverage.type),
      sire,
      donorInfo,
      recipientInfo,
      technician: coverage.technician || '',
      pregnancyResult: getPregnancyResultLabel(coverage.pregnancyResult),
      pregnancyCheckDate: coverage.pregnancyCheckDate
        ? formatDateBR(new Date(coverage.pregnancyCheckDate))
        : '',
      expectedCalvingDate: coverage.expectedCalvingDate
        ? formatDateBR(new Date(coverage.expectedCalvingDate))
        : '',
      notes: coverage.notes || '',
    };
  }).sort((a, b) => a.coverageDate.localeCompare(b.coverageDate));
};

export const exportBreedingSeasonToCSV = (
  season: BreedingSeason,
  animals: Animal[],
  filename?: string
) => {
  const data = prepareBreedingSeasonDataForExport(season, animals);
  if (data.length === 0) {
    alert('Nenhuma cobertura registrada nesta estação de monta.');
    return;
  }

  const safeName = season.name.replace(/[^a-zA-Z0-9]/g, '_');
  const finalFilename = filename || `estacao_monta_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;

  exportToCSV(data, BREEDING_SEASON_HEADERS, finalFilename);
};

export const exportBreedingSeasonToPDF = (
  season: BreedingSeason,
  animals: Animal[]
) => {
  const data = prepareBreedingSeasonDataForExport(season, animals);

  const startDate = season.startDate ? formatDateBR(new Date(season.startDate)) : '';
  const endDate = season.endDate ? formatDateBR(new Date(season.endDate)) : '';
  const currentDate = new Date().toLocaleDateString('pt-BR');

  // Estatísticas
  const totalCoverages = data.length;
  const pregnantCount = data.filter(d => d.pregnancyResult === 'Prenhe').length;
  const emptyCount = data.filter(d => d.pregnancyResult === 'Vazia').length;
  const pendingCount = data.filter(d => d.pregnancyResult === 'Aguardando').length;

  // Contagem por tipo
  const typeCounts: Record<string, number> = {};
  data.forEach(d => {
    typeCounts[d.coverageType] = (typeCounts[d.coverageType] || 0) + 1;
  });

  // FIV específico
  const fivCount = data.filter(d => d.coverageType === 'FIV (Fertilização In Vitro)').length;
  const fivRecords = data.filter(d => d.coverageType === 'FIV (Fertilização In Vitro)');

  const styles = `
    <style>
      @page { size: A4 landscape; margin: 1.5cm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; color: #222; margin: 0; }
      h1 { margin: 0; color: #381b18; font-size: 18px; }
      h2 { color: #381b18; font-size: 14px; margin: 16px 0 8px 0; border-bottom: 2px solid #381b18; padding-bottom: 4px; }
      .header { text-align: center; margin-bottom: 16px; }
      .subtitle { color: #666; margin-top: 4px; font-size: 11px; }
      .date { color: #999; font-size: 10px; margin-top: 2px; }
      .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
      .stat-card { background: #f8f9fa; border-radius: 8px; padding: 12px; text-align: center; border-left: 4px solid #381b18; }
      .stat-card.success { border-left-color: #10b981; }
      .stat-card.warning { border-left-color: #f59e0b; }
      .stat-card.danger { border-left-color: #ef4444; }
      .stat-card.info { border-left-color: #3b82f6; }
      .stat-card .value { font-size: 20px; font-weight: bold; color: #381b18; }
      .stat-card .label { font-size: 10px; color: #666; margin-top: 4px; }
      .type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
      .type-card { background: #f0f4f8; padding: 8px; border-radius: 6px; text-align: center; }
      .type-card .value { font-weight: bold; color: #1f2937; }
      .type-card .label { font-size: 9px; color: #6b7280; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8px; }
      th { background: #381b18; color: white; padding: 6px 4px; text-align: left; font-weight: 600; }
      td { border-bottom: 1px solid #eee; padding: 5px 4px; }
      tr:nth-child(even) { background: #fafafa; }
      .badge { padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: 500; }
      .badge-success { background: #d1fae5; color: #065f46; }
      .badge-danger { background: #fee2e2; color: #991b1b; }
      .badge-warning { background: #fef3c7; color: #92400e; }
      .badge-info { background: #dbeafe; color: #1e40af; }
      .fiv-section { background: #fdf4ff; border: 1px solid #e879f9; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
      .fiv-title { color: #a21caf; font-weight: bold; margin-bottom: 8px; }
      .legend { margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 8px; }
      .legend h4 { margin: 0 0 8px 0; color: #374151; }
      .legend-item { display: inline-block; margin-right: 16px; font-size: 9px; }
      .footer { margin-top: 16px; text-align: center; color: #888; font-size: 8px; }
      @media print {
        .no-print { display: none; }
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>
  `;

  let html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Estação de Monta - ${season.name}</title>
      ${styles}
    </head>
    <body>
      <div class="header">
        <h1>Estação de Monta: ${season.name}</h1>
        <div class="subtitle">Período: ${startDate} a ${endDate}</div>
        <div class="date">Relatório gerado em: ${currentDate}</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${totalCoverages}</div>
          <div class="label">Total Coberturas</div>
        </div>
        <div class="stat-card success">
          <div class="value">${pregnantCount}</div>
          <div class="label">Prenhes</div>
        </div>
        <div class="stat-card danger">
          <div class="value">${emptyCount}</div>
          <div class="label">Vazias</div>
        </div>
        <div class="stat-card warning">
          <div class="value">${pendingCount}</div>
          <div class="label">Aguardando</div>
        </div>
        <div class="stat-card info">
          <div class="value">${totalCoverages > 0 ? ((pregnantCount / totalCoverages) * 100).toFixed(1) : 0}%</div>
          <div class="label">Taxa Prenhez</div>
        </div>
      </div>

      <div class="type-grid">
        ${Object.entries(typeCounts).map(([type, count]) => `
          <div class="type-card">
            <div class="value">${count}</div>
            <div class="label">${type}</div>
          </div>
        `).join('')}
      </div>
  `;

  // Seção especial para FIV
  if (fivCount > 0) {
    html += `
      <div class="fiv-section">
        <div class="fiv-title">🧬 Detalhamento FIV (${fivCount} registros)</div>
        <p style="font-size: 9px; color: #6b21a8; margin: 0 0 8px 0;">
          <strong>Importante:</strong> Em FIV, a <em>Doadora</em> é a mãe biológica (genética) e a <em>Receptora</em> é quem gestará o embrião.
          Os dados de progênie são registrados na <strong>Doadora</strong> para fins de DEP e seleção genética.
        </p>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Doadora (Mãe Biológica)</th>
              <th>Receptora (Gestante)</th>
              <th>Touro/Sêmen</th>
              <th>Resultado</th>
              <th>Previsão Parto</th>
            </tr>
          </thead>
          <tbody>
            ${fivRecords.map(r => `
              <tr>
                <td>${r.coverageDate}</td>
                <td><strong>${r.donorInfo || '-'}</strong></td>
                <td>${r.recipientInfo || r.cowBrinco}</td>
                <td>${r.sire}</td>
                <td><span class="badge ${r.pregnancyResult === 'Prenhe' ? 'badge-success' : r.pregnancyResult === 'Vazia' ? 'badge-danger' : 'badge-warning'}">${r.pregnancyResult}</span></td>
                <td>${r.expectedCalvingDate || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Tabela geral de coberturas
  html += `
      <h2>Registro Completo de Coberturas</h2>
      <table>
        <thead>
          <tr>
            <th>Vaca</th>
            <th>Data</th>
            <th>Tipo</th>
            <th>Touro/Sêmen</th>
            <th>Doadora (FIV)</th>
            <th>Técnico</th>
            <th>Resultado</th>
            <th>Data Diag.</th>
            <th>Prev. Parto</th>
            <th>Obs.</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td>${r.cowBrinco}</td>
              <td>${r.coverageDate}</td>
              <td>${r.coverageType}</td>
              <td>${r.sire}</td>
              <td>${r.donorInfo || '-'}</td>
              <td>${r.technician || '-'}</td>
              <td><span class="badge ${r.pregnancyResult === 'Prenhe' ? 'badge-success' : r.pregnancyResult === 'Vazia' ? 'badge-danger' : 'badge-warning'}">${r.pregnancyResult}</span></td>
              <td>${r.pregnancyCheckDate || '-'}</td>
              <td>${r.expectedCalvingDate || '-'}</td>
              <td>${r.notes || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="legend">
        <h4>Legenda</h4>
        <div class="legend-item"><span class="badge badge-success">Prenhe</span> Diagnóstico positivo</div>
        <div class="legend-item"><span class="badge badge-danger">Vazia</span> Diagnóstico negativo</div>
        <div class="legend-item"><span class="badge badge-warning">Aguardando</span> Pendente de diagnóstico</div>
        <div class="legend-item"><strong>FIV:</strong> Doadora = mãe biológica | Receptora = gestante</div>
      </div>

      <div class="footer">
        Fazenda+ • Relatório de Estação de Monta gerado automaticamente
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup bloqueado! Permita popups para gerar o PDF.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
};
