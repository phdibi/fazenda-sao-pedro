import { Animal, FilteredStats, ManagementArea } from '../types';

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

  // Estilos CSS para o PDF
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

  // Construir HTML
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

  // Estatísticas resumidas
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

  // Tabela de animais
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

  // Abre em nova janela para impressão
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup bloqueado! Permita popups para gerar o PDF.');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Aguarda carregar e dispara impressão
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
};

// Exportação alternativa: baixar como HTML
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

// Função para preparar dados de animais para CSV
export const prepareAnimalDataForExport = (animals: Animal[]) => {
  return animals.map(animal => ({
    brinco: animal.brinco,
    nome: animal.nome || '',
    raca: animal.raca,
    sexo: animal.sexo,
    dataNascimento: new Date(animal.dataNascimento).toLocaleDateString('pt-BR'),
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