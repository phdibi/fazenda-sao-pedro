import { Animal, AnimalStatus, FilteredStats, ManagementArea, Sexo, WeighingType } from '../types';

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

const formatDateBR = (date: Date): string => {
  return new Date(date).toLocaleDateString('pt-BR');
};

const extractSpecialWeights = (animal: Animal) => {
  let birth: { weightKg: number; date: Date } | undefined;
  let weaning: { weightKg: number; date: Date } | undefined;
  let yearling: { weightKg: number; date: Date } | undefined;

  animal.historicoPesagens?.forEach(entry => {
    if (entry.type === WeighingType.Birth) {
      birth = { weightKg: entry.weightKg, date: entry.date };
    }
    if (entry.type === WeighingType.Weaning) {
      weaning = { weightKg: entry.weightKg, date: entry.date };
    }
    if (entry.type === WeighingType.Yearling) {
      yearling = { weightKg: entry.weightKg, date: entry.date };
    }
  });

  return { birth, weaning, yearling };
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
// RELATÓRIO DE TERNEIROS (DESMAME/SOBREANO)
// ============================================

const formatAreaName = (areas: ManagementArea[], id?: string) => {
  if (!id) return 'Sem área';
  return areas.find(a => a.id === id)?.name || 'Área desconhecida';
};

const monthsFromBirth = (birthDate?: Date) => {
  if (!birthDate) return Infinity;
  const birth = new Date(birthDate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return months;
};

const hasWeightMilestone = (animal: Animal) => {
  return animal.historicoPesagens?.some(entry =>
    entry.type === WeighingType.Birth || entry.type === WeighingType.Weaning || entry.type === WeighingType.Yearling
  );
};

const isCalfForSnapshot = (animal: Animal) => {
  const isJuvenile = monthsFromBirth(animal.dataNascimento) <= 18;
  const hasMaternalRef = Boolean(animal.maeNome || animal.maeRaca);
  return animal.status !== AnimalStatus.Obito && isJuvenile && (hasMaternalRef || hasWeightMilestone(animal));
};

export const prepareCalfSnapshotData = (animals: Animal[], areas: ManagementArea[]) => {
  return animals
    .filter(isCalfForSnapshot)
    .map(animal => {
      const { birth, weaning, yearling } = extractSpecialWeights(animal);

      return {
        brinco: animal.brinco,
        nome: animal.nome || '',
        sexo: animal.sexo,
        raca: animal.raca,
        status: animal.status,
        dataNascimento: animal.dataNascimento ? formatDateBR(animal.dataNascimento) : '',
        maeNome: animal.maeNome || '',
        maeRaca: animal.maeRaca || '',
        area: formatAreaName(areas, animal.managementAreaId),
        pesoNascimentoKg: birth?.weightKg ?? '',
        dataPesoNascimento: birth ? formatDateBR(birth.date) : '',
        pesoDesmameKg: weaning?.weightKg ?? '',
        dataDesmame: weaning ? formatDateBR(weaning.date) : '',
        pesoSobreanoKg: yearling?.weightKg ?? '',
        dataSobreano: yearling ? formatDateBR(yearling.date) : '',
        pesoAtualKg: animal.pesoKg,
      };
    })
    .filter(record =>
      record.maeNome || record.pesoNascimentoKg || record.pesoDesmameKg || record.pesoSobreanoKg
    )
    .sort((a, b) => (a.dataNascimento || '').localeCompare(b.dataNascimento || ''));
};

export const CALF_SNAPSHOT_HEADERS: Record<string, string> = {
  brinco: 'Brinco',
  nome: 'Nome',
  sexo: 'Sexo',
  raca: 'Raça',
  status: 'Status',
  area: 'Área',
  dataNascimento: 'Nascimento',
  maeNome: 'Mãe',
  maeRaca: 'Raça da Mãe',
  pesoNascimentoKg: 'Peso Nasc. (kg)',
  dataPesoNascimento: 'Data Nasc.',
  pesoDesmameKg: 'Peso Desmame (kg)',
  dataDesmame: 'Data Desmame',
  pesoSobreanoKg: 'Peso Sobreano (kg)',
  dataSobreano: 'Data Sobreano',
  pesoAtualKg: 'Peso Atual (kg)',
};

export const exportCalfSnapshotToCSV = (
  animals: Animal[],
  areas: ManagementArea[],
  filename = `terneiros_memoria_${new Date().toISOString().slice(0, 10)}.csv`
) => {
  const data = prepareCalfSnapshotData(animals, areas);
  if (data.length === 0) {
    alert('Nenhum terneiro com mãe ou pesos de desmame/sobreano para exportar. Ajuste os filtros.');
    return;
  }

  exportToCSV(data, CALF_SNAPSHOT_HEADERS, filename);
};

export const exportCalfSnapshotToPDF = (
  animals: Animal[],
  areas: ManagementArea[],
  title = 'Memória de Terneiros para Venda'
) => {
  const data = prepareCalfSnapshotData(animals, areas);
  if (data.length === 0) {
    alert('Nenhum terneiro com mãe ou pesos de desmame/sobreano para exportar. Ajuste os filtros.');
    return;
  }

  const currentDate = new Date().toLocaleDateString('pt-BR');

  const styles = `
    <style>
      @page { size: A4; margin: 1.5cm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #222; }
      h1 { margin: 0; color: #381b18; font-size: 20px; }
      .header { text-align: center; margin-bottom: 16px; }
      .subtitle { color: #666; margin-top: 4px; font-size: 12px; }
      .note { background: #f8f9fa; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #381b18; color: white; padding: 6px; text-align: left; font-weight: 600; }
      td { border-bottom: 1px solid #eee; padding: 6px; }
      tr:nth-child(even) { background: #fafafa; }
      .footer { margin-top: 16px; text-align: center; color: #888; font-size: 9px; }
    </style>
  `;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      ${styles}
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <div class="subtitle">${data.length} terneiros exportados • ${currentDate}</div>
      </div>
      <div class="note">
        Relatório preparado para guardar o histórico de pesos (nascimento, desmame, sobreano) e genealogia materna antes da venda anual.
        Utilize os filtros da listagem para selecionar apenas os terneiros daquele ano antes de exportar.
      </div>
      <table>
        <thead>
          <tr>
            <th>Brinco</th>
            <th>Nome</th>
            <th>Sexo</th>
            <th>Raça</th>
            <th>Mãe</th>
            <th>Raça da Mãe</th>
            <th>Nascimento</th>
            <th>Peso Nasc. (kg)</th>
            <th>Peso Desmame (kg)</th>
            <th>Peso Sobreano (kg)</th>
            <th>Peso Atual (kg)</th>
            <th>Área</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(item => `
            <tr>
              <td><strong>${item.brinco}</strong></td>
              <td>${item.nome || '-'}</td>
              <td>${item.sexo}</td>
              <td>${item.raca}</td>
              <td>${item.maeNome || '-'}</td>
              <td>${item.maeRaca || '-'}</td>
              <td>${item.dataNascimento || '-'}</td>
              <td>${item.pesoNascimentoKg || '-'}</td>
              <td>${item.pesoDesmameKg || '-'}</td>
              <td>${item.pesoSobreanoKg || '-'}</td>
              <td>${item.pesoAtualKg || '-'}</td>
              <td>${item.area}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">Fazenda+ • Relatório gerado automaticamente para memória de venda anual de terneiros</div>
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
