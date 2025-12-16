// ============================================
// 🔧 SERVIÇO DE BACKUP LOCAL
// ============================================
// Permite exportar e importar dados como JSON
// Útil para backups locais e migração de dados

import { Animal, CalendarEvent, Task, ManagementArea, ManagementBatch } from '../types';

// ============================================
// TIPOS
// ============================================

export interface BackupData {
    version: string;
    createdAt: string;
    userId: string;
    data: {
        animals: Animal[];
        calendarEvents: CalendarEvent[];
        tasks: Task[];
        managementAreas: ManagementArea[];
        batches: ManagementBatch[];
    };
    metadata: {
        totalAnimals: number;
        totalEvents: number;
        totalTasks: number;
        totalAreas: number;
        totalBatches: number;
        exportedBy: string;
    };
}

export interface BackupOptions {
    includeAnimals?: boolean;
    includeCalendar?: boolean;
    includeTasks?: boolean;
    includeAreas?: boolean;
    includeBatches?: boolean;
    compress?: boolean;
}

const BACKUP_VERSION = '1.0.0';

// ============================================
// EXPORTAÇÃO
// ============================================

/**
 * Cria um backup completo dos dados
 */
export const createBackup = (
    userId: string,
    data: {
        animals: Animal[];
        calendarEvents: CalendarEvent[];
        tasks: Task[];
        managementAreas: ManagementArea[];
        batches: ManagementBatch[];
    },
    options: BackupOptions = {}
): BackupData => {
    const {
        includeAnimals = true,
        includeCalendar = true,
        includeTasks = true,
        includeAreas = true,
        includeBatches = true,
    } = options;

    const backup: BackupData = {
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        userId,
        data: {
            animals: includeAnimals ? data.animals : [],
            calendarEvents: includeCalendar ? data.calendarEvents : [],
            tasks: includeTasks ? data.tasks : [],
            managementAreas: includeAreas ? data.managementAreas : [],
            batches: includeBatches ? data.batches : [],
        },
        metadata: {
            totalAnimals: includeAnimals ? data.animals.length : 0,
            totalEvents: includeCalendar ? data.calendarEvents.length : 0,
            totalTasks: includeTasks ? data.tasks.length : 0,
            totalAreas: includeAreas ? data.managementAreas.length : 0,
            totalBatches: includeBatches ? data.batches.length : 0,
            exportedBy: 'Fazenda São Pedro App',
        },
    };

    return backup;
};

/**
 * Exporta dados como arquivo JSON
 */
export const exportToJSON = (
    userId: string,
    data: {
        animals: Animal[];
        calendarEvents: CalendarEvent[];
        tasks: Task[];
        managementAreas: ManagementArea[];
        batches: ManagementBatch[];
    },
    options: BackupOptions = {}
): void => {
    const backup = createBackup(userId, data, options);
    const jsonString = JSON.stringify(backup, null, 2);

    // Cria blob e link para download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0];
    const filename = `fazenda-sao-pedro-backup-${date}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    console.log(`✅ [BACKUP] Exportado: ${filename} (${formatBytes(blob.size)})`);
};

/**
 * Exporta dados comprimidos (gzip simulado com base64)
 * Nota: Para compressão real, seria necessário uma lib como pako
 */
export const exportCompressed = async (
    userId: string,
    data: {
        animals: Animal[];
        calendarEvents: CalendarEvent[];
        tasks: Task[];
        managementAreas: ManagementArea[];
        batches: ManagementBatch[];
    },
    options: BackupOptions = {}
): Promise<void> => {
    const backup = createBackup(userId, data, options);
    const jsonString = JSON.stringify(backup);

    // Compressão usando CompressionStream (suportado em navegadores modernos)
    if ('CompressionStream' in window) {
        try {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(jsonString));
                    controller.close();
                }
            });

            const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
            const compressedBlob = await new Response(compressedStream).blob();

            const date = new Date().toISOString().split('T')[0];
            const filename = `fazenda-sao-pedro-backup-${date}.json.gz`;

            const url = URL.createObjectURL(compressedBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log(`✅ [BACKUP] Exportado comprimido: ${filename} (${formatBytes(compressedBlob.size)})`);
            return;
        } catch (error) {
            console.warn('⚠️ [BACKUP] Compressão falhou, usando JSON normal:', error);
        }
    }

    // Fallback para JSON normal
    exportToJSON(userId, data, options);
};

// ============================================
// IMPORTAÇÃO
// ============================================

/**
 * Valida estrutura do backup
 */
export const validateBackup = (data: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data) {
        errors.push('Arquivo vazio ou inválido');
        return { valid: false, errors };
    }

    if (!data.version) {
        errors.push('Versão do backup não encontrada');
    }

    if (!data.createdAt) {
        errors.push('Data de criação não encontrada');
    }

    if (!data.data) {
        errors.push('Dados do backup não encontrados');
        return { valid: false, errors };
    }

    // Verifica estrutura dos arrays
    const collections = ['animals', 'calendarEvents', 'tasks', 'managementAreas', 'batches'];
    for (const col of collections) {
        if (data.data[col] && !Array.isArray(data.data[col])) {
            errors.push(`${col} deve ser um array`);
        }
    }

    return { valid: errors.length === 0, errors };
};

/**
 * Lê arquivo de backup
 */
export const readBackupFile = (file: File): Promise<BackupData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                let content = event.target?.result as string;

                // Verifica se é arquivo comprimido (.gz)
                if (file.name.endsWith('.gz') && 'DecompressionStream' in window) {
                    const blob = new Blob([event.target?.result as ArrayBuffer]);
                    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
                    content = await new Response(stream).text();
                }

                const data = JSON.parse(content);
                const validation = validateBackup(data);

                if (!validation.valid) {
                    reject(new Error(`Backup inválido: ${validation.errors.join(', ')}`));
                    return;
                }

                resolve(data as BackupData);
            } catch (error) {
                reject(new Error('Falha ao processar arquivo de backup'));
            }
        };

        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));

        // Lê como texto para JSON ou ArrayBuffer para .gz
        if (file.name.endsWith('.gz')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
};

/**
 * Importa backup (retorna dados para processamento)
 */
export const importBackup = async (file: File): Promise<{
    backup: BackupData;
    summary: string;
}> => {
    const backup = await readBackupFile(file);

    const summary = `
📦 Backup de ${new Date(backup.createdAt).toLocaleDateString('pt-BR')}
• ${backup.metadata.totalAnimals} animais
• ${backup.metadata.totalEvents} eventos
• ${backup.metadata.totalTasks} tarefas
• ${backup.metadata.totalAreas} áreas
• ${backup.metadata.totalBatches} lotes
    `.trim();

    return { backup, summary };
};

// ============================================
// BACKUP AUTOMÁTICO (LocalStorage)
// ============================================

const AUTO_BACKUP_KEY = 'fazenda-auto-backup';
const MAX_AUTO_BACKUPS = 3;

/**
 * Salva backup automático no localStorage
 */
export const saveAutoBackup = (
    userId: string,
    data: {
        animals: Animal[];
        calendarEvents: CalendarEvent[];
        tasks: Task[];
        managementAreas: ManagementArea[];
        batches: ManagementBatch[];
    }
): void => {
    try {
        const backup = createBackup(userId, data);

        // Obtém backups existentes
        const existingBackups: BackupData[] = JSON.parse(
            localStorage.getItem(AUTO_BACKUP_KEY) || '[]'
        );

        // Adiciona novo backup no início
        existingBackups.unshift(backup);

        // Mantém apenas os últimos N backups
        const trimmedBackups = existingBackups.slice(0, MAX_AUTO_BACKUPS);

        localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(trimmedBackups));

        console.log(`💾 [AUTO-BACKUP] Salvo às ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        // localStorage pode estar cheio
        console.warn('⚠️ [AUTO-BACKUP] Falha ao salvar:', error);
    }
};

/**
 * Obtém backups automáticos salvos
 */
export const getAutoBackups = (): BackupData[] => {
    try {
        return JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY) || '[]');
    } catch {
        return [];
    }
};

/**
 * Restaura do backup automático mais recente
 */
export const getLatestAutoBackup = (): BackupData | null => {
    const backups = getAutoBackups();
    return backups[0] || null;
};

/**
 * Limpa backups automáticos
 */
export const clearAutoBackups = (): void => {
    localStorage.removeItem(AUTO_BACKUP_KEY);
    console.log('🧹 [AUTO-BACKUP] Backups automáticos limpos');
};

// ============================================
// UTILIDADES
// ============================================

/**
 * Formata bytes para string legível
 */
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Estima tamanho do backup
 */
export const estimateBackupSize = (data: {
    animals: Animal[];
    calendarEvents: CalendarEvent[];
    tasks: Task[];
    managementAreas: ManagementArea[];
    batches: ManagementBatch[];
}): string => {
    const jsonString = JSON.stringify(data);
    return formatBytes(jsonString.length * 2); // UTF-16 ~2 bytes por char
};
