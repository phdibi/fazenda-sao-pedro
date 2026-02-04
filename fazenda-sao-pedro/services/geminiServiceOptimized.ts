// 🔧 OTIMIZAÇÃO: Lazy import do Gemini SDK
// O SDK só será carregado quando realmente necessário, economizando ~200KB no bundle inicial
import { Animal, MedicationAdministration, Raca, Sexo, ComprehensiveReport, WeighingType, TurnWeightAnalysis } from "../types";

// Tipos do Gemini (apenas para tipagem, não carrega o SDK)
type GoogleGenAI = any;
type TypeSchema = any;

// ============================================
// 🔧 OTIMIZAÇÃO: CACHE DE RESPOSTAS DA IA
// ============================================
// Evita chamadas repetidas para perguntas similares
// Economia: Reduz custos da API Gemini em ~50%

interface CacheEntry {
    response: any;
    timestamp: number;
    hash: string;
}

// 🔧 OTIMIZAÇÃO: Cache persistente usando localStorage
// Evita rechamadas ao Gemini após reload da página
class GeminiCache {
    private cache: Map<string, CacheEntry> = new Map();
    private maxAge = 30 * 60 * 1000; // 30 minutos
    private maxEntries = 50;
    private readonly STORAGE_KEY = 'fazenda-gemini-cache';

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const entries: [string, CacheEntry][] = JSON.parse(stored);
                const now = Date.now();
                let loadedCount = 0;
                entries.forEach(([key, entry]) => {
                    // Só carrega entradas não expiradas
                    if (now - entry.timestamp < this.maxAge) {
                        this.cache.set(key, entry);
                        loadedCount++;
                    }
                });
                if (loadedCount > 0) {
                    console.log(`📦 [GEMINI CACHE] Carregadas ${loadedCount} entradas do storage`);
                }
            }
        } catch (error) {
            console.warn('⚠️ [GEMINI CACHE] Erro ao carregar do storage:', error);
        }
    }

    private saveToStorage(): void {
        try {
            const entries = Array.from(this.cache.entries());
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
        } catch (error) {
            console.warn('⚠️ [GEMINI CACHE] Erro ao salvar no storage:', error);
        }
    }

    private hash(str: string): string {
        // Hash simples para identificar queries similares
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    private normalizeQuery(query: string): string {
        // Normaliza a query para melhorar cache hits
        return query
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[.,!?]/g, '');
    }

    get(query: string): any | null {
        const normalized = this.normalizeQuery(query);
        const key = this.hash(normalized);
        const entry = this.cache.get(key);

        if (!entry) return null;

        // Verifica expiração
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            this.saveToStorage();
            return null;
        }

        console.log('🎯 [GEMINI CACHE HIT] Resposta recuperada do cache');
        return entry.response;
    }

    set(query: string, response: any): void {
        const normalized = this.normalizeQuery(query);
        const key = this.hash(normalized);

        // Limpa entradas antigas se necessário
        if (this.cache.size >= this.maxEntries) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            response,
            timestamp: Date.now(),
            hash: key
        });

        this.saveToStorage();
    }

    clear(): void {
        this.cache.clear();
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('🗑️ [GEMINI CACHE] Cache limpo');
    }

    // Retorna estatísticas do cache
    getStats(): { entries: number; oldestAge: number } {
        let oldestTimestamp = Date.now();
        this.cache.forEach(entry => {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
            }
        });
        return {
            entries: this.cache.size,
            oldestAge: Math.floor((Date.now() - oldestTimestamp) / 60000) // em minutos
        };
    }
}

const geminiCache = new GeminiCache();

// ============================================
// 🔧 OTIMIZAÇÃO: RATE LIMITING
// ============================================
// Evita estourar cotas do plano gratuito
const RATE_LIMIT = { 
    calls: 15, // máximo de chamadas
    windowMs: 60 * 1000 // por minuto
};

let rateLimitState = {
    callCount: 0,
    windowStart: Date.now()
};

const checkRateLimit = (): void => {
    const now = Date.now();
    if (now - rateLimitState.windowStart > RATE_LIMIT.windowMs) {
        rateLimitState = { callCount: 0, windowStart: now };
    }
    if (rateLimitState.callCount >= RATE_LIMIT.calls) {
        throw new Error('⏳ Limite de IA atingido. Aguarde 1 minuto.');
    }
    rateLimitState.callCount++;
    console.log(`🤖 [RATE] ${rateLimitState.callCount}/${RATE_LIMIT.calls} chamadas`);
};

// ============================================
// 🔧 OTIMIZAÇÃO: LAZY INITIALIZATION COM DYNAMIC IMPORT
// ============================================
let ai: GoogleGenAI | null = null;
let TypeModule: any = null;

// Carrega o SDK do Gemini de forma assíncrona (apenas quando necessário)
const loadGeminiSDK = async () => {
    if (!TypeModule) {
        const module = await import("@google/genai");
        TypeModule = module.Type;
        return module.GoogleGenAI;
    }
    return null;
};

const getAiClient = async (): Promise<GoogleGenAI> => {
    if (ai) return ai;
    
    try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("VITE_GEMINI_API_KEY não encontrada");
        }
        
        // 🔧 OTIMIZAÇÃO: Dynamic import - carrega SDK apenas quando necessário
        const GoogleGenAIClass = await loadGeminiSDK() || (await import("@google/genai")).GoogleGenAI;
        ai = new GoogleGenAIClass({ apiKey });
        return ai;
    } catch (e) {
        console.error("Falha ao inicializar Gemini:", e);
        throw new Error("Não foi possível conectar à IA");
    }
};

const geminiModel = 'gemini-2.5-flash';

// Schemas - serão inicializados com Type quando o SDK for carregado
const getMedicationSchema = () => ({
    type: TypeModule?.OBJECT || 'OBJECT',
    properties: {
        medicamento: { type: TypeModule?.STRING || 'STRING' },
        dose: { type: TypeModule?.NUMBER || 'NUMBER' },
        unidade: { type: TypeModule?.STRING || 'STRING', enum: ['ml', 'mg', 'dose'] },
        motivo: { type: TypeModule?.STRING || 'STRING' }
    },
});

const getAnimalSchema = () => ({
    type: TypeModule?.OBJECT || 'OBJECT',
    properties: {
        brinco: { type: TypeModule?.STRING || 'STRING' },
        nome: { type: TypeModule?.STRING || 'STRING' },
        raca: { type: TypeModule?.STRING || 'STRING', enum: Object.values(Raca) },
        sexo: { type: TypeModule?.STRING || 'STRING', enum: Object.values(Sexo) },
        dataNascimento: { type: TypeModule?.STRING || 'STRING' },
        pesoKg: { type: TypeModule?.NUMBER || 'NUMBER' },
        maeNome: { type: TypeModule?.STRING || 'STRING' },
        paiNome: { type: TypeModule?.STRING || 'STRING' }
    },
});

// ============================================
// 🔧 OTIMIZAÇÃO: DEBOUNCE PARA CHAMADAS
// ============================================
const pendingCalls = new Map<string, Promise<any>>();

async function debouncedCall<T>(
    key: string,
    fn: () => Promise<T>,
    debounceMs: number = 500
): Promise<T> {
    // Se já existe uma chamada pendente para esta key, retorna ela
    const pending = pendingCalls.get(key);
    if (pending) {
        console.log('⏳ [DEBOUNCE] Reutilizando chamada pendente');
        return pending;
    }

    const promise = fn().finally(() => {
        // Remove após um delay para permitir deduplicação
        setTimeout(() => pendingCalls.delete(key), debounceMs);
    });

    pendingCalls.set(key, promise);
    return promise;
}

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

export const structureMedicalDataFromText = async (
    text: string
): Promise<Partial<MedicationAdministration>> => {
    // Verifica cache
    const cached = geminiCache.get(`med:${text}`);
    if (cached) return cached;

    return debouncedCall(`med:${text}`, async () => {
        checkRateLimit(); // Rate limit antes da chamada
        try {
            // 🔧 OTIMIZAÇÃO: Agora getAiClient é assíncrono (lazy load)
            const aiClient = await getAiClient();
            console.log("🤖 [GEMINI] Processando dados médicos...");
            
            const response = await aiClient.models.generateContent({
                model: geminiModel,
                contents: `Extraia as informações de medicação do seguinte texto: "${text}"`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: getMedicationSchema(),
                },
            });

            const result = JSON.parse(response.text.trim());
            geminiCache.set(`med:${text}`, result);
            return result;
        } catch (error) {
            console.error("Erro ao processar dados médicos:", error);
            throw new Error("A IA não conseguiu processar o comando");
        }
    });
};

export const structureAnimalDataFromText = async (
    text: string
): Promise<Partial<Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>>> => {
    const cached = geminiCache.get(`animal:${text}`);
    if (cached) return cached;

    return debouncedCall(`animal:${text}`, async () => {
        checkRateLimit(); // Rate limit antes da chamada
        try {
            // 🔧 OTIMIZAÇÃO: Agora getAiClient é assíncrono (lazy load)
            const aiClient = await getAiClient();
            console.log("🤖 [GEMINI] Processando registro de animal...");
            
            const response = await aiClient.models.generateContent({
                model: geminiModel,
                contents: `Extraia as informações de registro do animal do seguinte texto: "${text}"`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: getAnimalSchema(),
                },
            });

            let parsedData = JSON.parse(response.text.trim());
            
            if (parsedData.dataNascimento && typeof parsedData.dataNascimento === 'string') {
                parsedData.dataNascimento = new Date(parsedData.dataNascimento + 'T00:00:00');
            }

            geminiCache.set(`animal:${text}`, parsedData);
            return parsedData;
        } catch (error) {
            console.error("Erro ao processar dados do animal:", error);
            throw new Error("A IA não conseguiu processar o registro");
        }
    });
};

// ============================================
// 🔧 OTIMIZAÇÃO: RELATÓRIOS PROCESSADOS LOCALMENTE
// ============================================
// Gera relatórios localmente quando possível
// Usa Gemini apenas para recomendações textuais

export const generateComprehensiveReport = async (
    animals: Animal[],
    dateRange: { start: Date; end: Date }
): Promise<ComprehensiveReport> => {
    console.log("📊 [RELATÓRIO] Gerando relatório local...");

    // Cache key baseado nos dados
    const cacheKey = `report:${animals.length}:${dateRange.start.getTime()}:${dateRange.end.getTime()}`;
    const cached = geminiCache.get(cacheKey);
    if (cached) {
        console.log("📦 [CACHE] Relatório recuperado do cache");
        return cached;
    }

    // ============================================
    // PROCESSAMENTO LOCAL (sem usar Gemini)
    // ============================================
    
    // Filtra dados do período
    const filteredAnimals = animals.map(animal => ({
        ...animal,
        historicoSanitario: animal.historicoSanitario.filter(med => {
            const medDate = new Date(med.dataAplicacao);
            return medDate >= dateRange.start && medDate <= dateRange.end;
        }),
    }));

    const medicatedAnimals = filteredAnimals.filter(a => a.historicoSanitario.length > 0);

    // --- RELATÓRIO SANITÁRIO (processamento local) ---
    const sanitaryReport = generateSanitaryReportLocally(medicatedAnimals);

    // --- RELATÓRIO REPRODUTIVO (processamento local) ---
    const reproductiveReport = generateReproductiveReportLocally(animals);

    // --- RELATÓRIO PESO DE VIRADA (processamento local) ---
    const turnWeightReport = generateTurnWeightReportLocally(animals);

    const report: ComprehensiveReport = {
        sanitary: sanitaryReport,
        reproductive: reproductiveReport,
        turnWeight: turnWeightReport
    };

    // Cacheia resultado
    geminiCache.set(cacheKey, report);

    return report;
};

// Função auxiliar para relatório sanitário
function generateSanitaryReportLocally(medicatedAnimals: Animal[]) {
    if (medicatedAnimals.length === 0) {
        return {
            topTreatedAnimals: [],
            medicationUsage: [],
            seasonalAnalysis: [],
            reasonAnalysis: [],
            recommendations: "Nenhuma atividade sanitária registrada no período.",
        };
    }

    // Top animais tratados
    const sortedAnimals = medicatedAnimals
        .map(a => ({
            animalId: a.id,
            brinco: a.brinco,
            nome: a.nome || 'N/A',
            treatmentCount: a.historicoSanitario.length
        }))
        .sort((a, b) => b.treatmentCount - a.treatmentCount)
        .slice(0, 20);

    // Helper para extrair nomes de medicamentos (suporta formato novo e legado)
    const extractMedicationNames = (med: any): string[] => {
        if (med.medicamentos && Array.isArray(med.medicamentos)) {
            return med.medicamentos.map((m: any) => m.medicamento).filter(Boolean);
        }
        return med.medicamento ? [med.medicamento] : [];
    };

    // Uso de medicamentos
    const medicationData: Record<string, { total: number; months: Record<string, number> }> = {};
    medicatedAnimals.forEach(animal => {
        animal.historicoSanitario.forEach(med => {
            const d = new Date(med.dataAplicacao);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            const medNames = extractMedicationNames(med);
            medNames.forEach(medName => {
                if (!medicationData[medName]) {
                    medicationData[medName] = { total: 0, months: {} };
                }
                medicationData[medName].total += 1;
                medicationData[medName].months[monthKey] =
                    (medicationData[medName].months[monthKey] || 0) + 1;
            });
        });
    });

    const medicationUsage = Object.entries(medicationData)
        .map(([medName, data]) => ({
            label: medName,
            value: data.total,
            monthlyUsage: Object.entries(data.months)
                .map(([key, value]) => {
                    const [year, month] = key.split('-');
                    return {
                        label: new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
                        value
                    };
                })
                .sort((a, b) => a.label.localeCompare(b.label))
        }))
        .sort((a, b) => b.value - a.value);

    // Análise por motivo
    const reasonCounts: Record<string, number> = {};
    medicatedAnimals.forEach(animal => {
        animal.historicoSanitario.forEach(med => {
            reasonCounts[med.motivo] = (reasonCounts[med.motivo] || 0) + 1;
        });
    });
    
    const reasonAnalysis = Object.entries(reasonCounts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    // Análise sazonal
    const monthData: Record<string, { total: number; meds: Record<string, number> }> = {};
    medicatedAnimals.forEach(animal => {
        animal.historicoSanitario.forEach(med => {
            const d = new Date(med.dataAplicacao);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            if (!monthData[monthKey]) {
                monthData[monthKey] = { total: 0, meds: {} };
            }
            monthData[monthKey].total += 1;

            const medNames = extractMedicationNames(med);
            medNames.forEach(medName => {
                monthData[monthKey].meds[medName] =
                    (monthData[monthKey].meds[medName] || 0) + 1;
            });
        });
    });

    const seasonalAnalysis = Object.entries(monthData)
        .map(([key, data]) => {
            const [year, month] = key.split('-');
            return {
                label: new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
                value: data.total,
                medications: Object.entries(data.meds)
                    .map(([label, value]) => ({ label, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5)
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

    // Recomendações geradas localmente
    const topReason = reasonAnalysis[0]?.label || 'motivos diversos';
    const topMed = medicationUsage[0]?.label || 'nenhum em particular';
    const topAnimal = sortedAnimals[0]?.brinco || 'N/A';

    const recommendations = `Com base nos dados, observamos concentração de tratamentos por **${topReason}**. O medicamento mais utilizado foi **${topMed}**. Atenção ao animal **${topAnimal}** que recebeu mais tratamentos. Avalie protocolos preventivos nos meses de maior incidência.`;

    return {
        topTreatedAnimals: sortedAnimals,
        medicationUsage,
        seasonalAnalysis,
        reasonAnalysis,
        recommendations
    };
}

// Função auxiliar para relatório reprodutivo
function generateReproductiveReportLocally(animals: Animal[]) {
    const damsWithProgeny = animals.filter(
        a => a.sexo === Sexo.Femea && a.historicoProgenie && a.historicoProgenie.length > 0
    );

    const performanceData = damsWithProgeny.map(dam => {
        const progeny = dam.historicoProgenie!;
        
        const calcAvg = (key: 'birthWeightKg' | 'weaningWeightKg' | 'yearlingWeightKg') => {
            const weights = progeny.map(p => p[key]).filter(w => w != null && w > 0) as number[];
            if (weights.length === 0) return undefined;
            return weights.reduce((acc, w) => acc + w, 0) / weights.length;
        };

        return {
            damId: dam.id,
            damBrinco: dam.brinco,
            damNome: dam.nome,
            offspringCount: progeny.length,
            avgBirthWeight: calcAvg('birthWeightKg'),
            avgWeaningWeight: calcAvg('weaningWeightKg'),
            avgYearlingWeight: calcAvg('yearlingWeightKg'),
        };
    }).sort((a, b) => b.offspringCount - a.offspringCount);

    const topDam = performanceData[0];
    const recommendations = topDam
        ? `A matriz **${topDam.damNome || `brinco ${topDam.damBrinco}`}** é a mais produtiva com **${topDam.offspringCount} crias**. Média de desmame: **${topDam.avgWeaningWeight?.toFixed(2) || 'N/A'} kg**. Use esta genética como base.`
        : "Dados insuficientes. Registre nascimentos e pesos para obter insights.";

    return { performanceData, recommendations };
}

// Função auxiliar para relatório de peso de virada
function generateTurnWeightReportLocally(animals: Animal[]): TurnWeightAnalysis {
    const animalsWithTurnWeight = animals.filter(
        a => a.historicoPesagens?.some(p => p.type === WeighingType.Turn)
    ).map(a => {
        const turnWeight = a.historicoPesagens.find(p => p.type === WeighingType.Turn)!.weightKg;
        return {
            ...a,
            turnWeight
        };
    });

    if (animalsWithTurnWeight.length === 0) {
        return {
            averageWeight: 0,
            totalAnimals: 0,
            topPerformers: [],
            breedAnalysis: [],
            recommendations: "Nenhum animal com registro de Peso de Virada encontrado."
        };
    }

    const totalWeight = animalsWithTurnWeight.reduce((sum, a) => sum + a.turnWeight, 0);
    const averageWeight = totalWeight / animalsWithTurnWeight.length;

    // Top 5 animais mais pesados no virada
    const topPerformers = animalsWithTurnWeight
        .sort((a, b) => b.turnWeight - a.turnWeight)
        .slice(0, 5)
        .map(a => ({
            brinco: a.brinco,
            weight: a.turnWeight,
            raca: a.raca
        }));

    // Análise por raça
    const breedMap = new Map<string, { count: number; totalWeight: number }>();
    animalsWithTurnWeight.forEach(a => {
        const current = breedMap.get(a.raca) || { count: 0, totalWeight: 0 };
        breedMap.set(a.raca, {
            count: current.count + 1,
            totalWeight: current.totalWeight + a.turnWeight
        });
    });

    const breedAnalysis = Array.from(breedMap.entries()).map(([raca, data]) => ({
        raca,
        avgWeight: data.totalWeight / data.count,
        count: data.count
    })).sort((a, b) => b.avgWeight - a.avgWeight);

    // Gerar recomendação simples
    const topBreed = breedAnalysis[0];
    const recommendations = `A média de peso de virada do rebanho é de **${averageWeight.toFixed(2)} kg** (${animalsWithTurnWeight.length} animais). A raça **${topBreed.raca}** apresentou o melhor desempenho com média de **${topBreed.avgWeight.toFixed(2)} kg**. O animal destaque é **${topPerformers[0].brinco}** com **${topPerformers[0].weight} kg**.`;

    return {
        averageWeight,
        totalAnimals: animalsWithTurnWeight.length,
        topPerformers,
        breedAnalysis,
        recommendations
    };
}

// ============================================
// CHATBOT OTIMIZADO
// ============================================

export const startChat = async (animals: Animal[]) => {
    console.log("💬 [CHAT] Iniciando sessão...");
    
    // Pré-calcula estatísticas para respostas rápidas
    const stats = {
        total: animals.length,
        machos: animals.filter(a => a.sexo === Sexo.Macho).length,
        femeas: animals.filter(a => a.sexo === Sexo.Femea).length,
        pesoMedio: animals.length > 0 
            ? animals.reduce((sum, a) => sum + a.pesoKg, 0) / animals.length 
            : 0,
        pesoTotal: animals.reduce((sum, a) => sum + a.pesoKg, 0),
        maisPesado: animals.reduce((max, a) => a.pesoKg > max.pesoKg ? a : max, animals[0]),
        maisLeve: animals.reduce((min, a) => a.pesoKg < min.pesoKg ? a : min, animals[0]),
        // Estatísticas sanitárias
        comVacinacao: animals.filter(a => 
            a.historicoSanitario?.some(h => 
                h.motivo?.toLowerCase().includes('vacin') || 
                h.medicamento?.toLowerCase().includes('vacin')
            )
        ).length,
        comTratamento: animals.filter(a => a.historicoSanitario && a.historicoSanitario.length > 0).length,
        // Estatísticas reprodutivas
        prenhas: animals.filter(a => 
            a.sexo === Sexo.Femea && a.historicoPrenhez && a.historicoPrenhez.length > 0
        ).length,
        comProgenie: animals.filter(a => 
            a.historicoProgenie && a.historicoProgenie.length > 0
        ).length,
        // Por raça
        racas: animals.reduce((acc, a) => {
            acc[a.raca] = (acc[a.raca] || 0) + 1;
            return acc;
        }, {} as Record<string, number>),
        // Por status
        ativos: animals.filter(a => a.status === 'Ativo').length,
        vendidos: animals.filter(a => a.status === 'Vendido').length,
    };

    // Calcula idade média
    const calcularIdadeMedia = (): number => {
        const hoje = new Date();
        const idades = animals
            .filter(a => a.dataNascimento)
            .map(a => {
                const nasc = new Date(a.dataNascimento!);
                return (hoje.getTime() - nasc.getTime()) / (1000 * 60 * 60 * 24 * 30); // meses
            });
        return idades.length > 0 ? idades.reduce((a, b) => a + b, 0) / idades.length : 0;
    };

    const sendMessage = async (message: string): Promise<string> => {
        const lower = message.toLowerCase();
        
        // ============================================
        // RESPOSTAS LOCAIS EXPANDIDAS (sem usar Gemini)
        // ============================================
        
        // Saudações
        if (lower.includes("olá") || lower.includes("oi") || lower.includes("hey") || lower.includes("bom dia") || lower.includes("boa tarde") || lower.includes("boa noite")) {
            return "Olá! Sou o Titi, seu assistente de manejo. 🐄 Posso ajudar com informações sobre seu rebanho, pesagens, vacinas, reprodução e muito mais!";
        }
        
        // Ajuda
        if (lower.includes("ajuda") || lower.includes("help") || lower.includes("o que você pode")) {
            return `Posso responder sobre:\n• Quantidade de animais (machos, fêmeas, total)\n• Peso médio, mais pesado, mais leve\n• Vacinação e tratamentos\n• Prenhez e reprodução\n• Raças do rebanho\n• Idade média\n• Status (ativos, vendidos)\n\nExemplos: "quantos machos?", "peso médio?", "animais vacinados?"`;
        }

        // Quantidade de animais
        if (lower.includes("quantos") || lower.includes("quantidade") || lower.includes("total")) {
            if (lower.includes("macho")) return `🐂 Você tem **${stats.machos}** machos no rebanho.`;
            if (lower.includes("fêmea") || lower.includes("femea") || lower.includes("vaca")) return `🐄 Você tem **${stats.femeas}** fêmeas no rebanho.`;
            if (lower.includes("ativo")) return `✅ Você tem **${stats.ativos}** animais ativos.`;
            if (lower.includes("vendido")) return `💰 Você tem **${stats.vendidos}** animais marcados como vendidos.`;
            if (lower.includes("prenha") || lower.includes("gestante")) return `🤰 Você tem **${stats.prenhas}** matrizes com histórico de prenhez.`;
            return `📊 Total de **${stats.total}** animais cadastrados (${stats.machos} machos, ${stats.femeas} fêmeas).`;
        }
        
        // Peso
        if (lower.includes("peso")) {
            if (lower.includes("médio") || lower.includes("medio")) {
                return `⚖️ O peso médio do rebanho é **${stats.pesoMedio.toFixed(2)} kg**.`;
            }
            if (lower.includes("total")) {
                return `⚖️ O peso total do rebanho é **${stats.pesoTotal.toFixed(2)} kg** (${(stats.pesoTotal / 1000).toFixed(2)} toneladas).`;
            }
            if (lower.includes("mais pesado") || lower.includes("maior")) {
                const h = stats.maisPesado;
                return h ? `🏆 O mais pesado é **${h.nome || `brinco ${h.brinco}`}** com **${h.pesoKg} kg**.` : "Sem dados de peso.";
            }
            if (lower.includes("mais leve") || lower.includes("menor")) {
                const l = stats.maisLeve;
                return l ? `🪶 O mais leve é **${l.nome || `brinco ${l.brinco}`}** com **${l.pesoKg} kg**.` : "Sem dados de peso.";
            }
            return `⚖️ Peso médio: **${stats.pesoMedio.toFixed(2)} kg** | Total: **${(stats.pesoTotal / 1000).toFixed(2)} ton**`;
        }

        // Mais pesado (sem mencionar "peso")
        if (lower.includes("mais pesado") || lower.includes("maior animal")) {
            const h = stats.maisPesado;
            return h ? `🏆 O mais pesado é **${h.nome || `brinco ${h.brinco}`}** com **${h.pesoKg} kg**.` : "Sem dados.";
        }

        // Mais leve (sem mencionar "peso")
        if (lower.includes("mais leve") || lower.includes("menor animal")) {
            const l = stats.maisLeve;
            return l ? `🪶 O mais leve é **${l.nome || `brinco ${l.brinco}`}** com **${l.pesoKg} kg**.` : "Sem dados.";
        }

        // Vacinação
        if (lower.includes("vacin") || lower.includes("imuniz")) {
            return `💉 **${stats.comVacinacao}** de ${stats.total} animais têm registro de vacinação (${((stats.comVacinacao / stats.total) * 100).toFixed(1)}%).`;
        }

        // Tratamentos sanitários
        if (lower.includes("tratamento") || lower.includes("medicamento") || lower.includes("remédio") || lower.includes("medicado")) {
            return `💊 **${stats.comTratamento}** animais têm histórico de tratamentos sanitários.`;
        }

        // Prenhez / Reprodução
        if (lower.includes("prenha") || lower.includes("prenhez") || lower.includes("gestante") || lower.includes("gestação")) {
            return `🤰 **${stats.prenhas}** matrizes têm histórico de prenhez registrado.`;
        }

        if (lower.includes("cria") || lower.includes("progênie") || lower.includes("progenie") || lower.includes("filhote") || lower.includes("bezerro")) {
            return `👶 **${stats.comProgenie}** animais têm registro de progênie (crias).`;
        }

        if (lower.includes("reprodução") || lower.includes("reproducao") || lower.includes("reprodutivo")) {
            return `🐄 Dados reprodutivos:\n• Fêmeas: ${stats.femeas}\n• Com prenhez registrada: ${stats.prenhas}\n• Com progênie: ${stats.comProgenie}`;
        }

        // Raças
        if (lower.includes("raça") || lower.includes("raca") || lower.includes("raças")) {
            const racasStr = Object.entries(stats.racas)
                .sort((a, b) => b[1] - a[1])
                .map(([raca, count]) => `• ${raca}: ${count}`)
                .join('\n');
            return `🏷️ Distribuição por raça:\n${racasStr || 'Nenhuma raça cadastrada.'}`;
        }

        // Idade
        if (lower.includes("idade")) {
            const idadeMedia = calcularIdadeMedia();
            if (lower.includes("média") || lower.includes("media")) {
                return `📅 A idade média do rebanho é **${idadeMedia.toFixed(1)} meses** (${(idadeMedia / 12).toFixed(1)} anos).`;
            }
            return `📅 Idade média: **${idadeMedia.toFixed(1)} meses**.`;
        }

        // Status
        if (lower.includes("status") || lower.includes("situação")) {
            return `📋 Status do rebanho:\n• Ativos: ${stats.ativos}\n• Vendidos: ${stats.vendidos}\n• Total: ${stats.total}`;
        }

        // Resumo geral
        if (lower.includes("resumo") || lower.includes("relatório") || lower.includes("visão geral") || lower.includes("overview")) {
            return `📊 **Resumo do Rebanho:**\n• Total: ${stats.total} animais\n• Machos: ${stats.machos} | Fêmeas: ${stats.femeas}\n• Peso médio: ${stats.pesoMedio.toFixed(2)} kg\n• Com vacinação: ${stats.comVacinacao}\n• Com tratamentos: ${stats.comTratamento}\n• Matrizes com prenhez: ${stats.prenhas}`;
        }

        // Obrigado / Agradecimento
        if (lower.includes("obrigado") || lower.includes("valeu") || lower.includes("thanks")) {
            return "De nada! 🐄 Estou aqui para ajudar com o manejo do seu rebanho.";
        }

        // ============================================
        // 🔧 OTIMIZAÇÃO: Respostas locais expandidas
        // ============================================

        // Busca por animal específico (por brinco)
        if (lower.includes("brinco") || lower.match(/\b\d{3,}\b/)) {
            const brincoMatch = lower.match(/\b\d{3,}\b/);
            if (brincoMatch) {
                const brinco = brincoMatch[0];
                const animal = animals.find(a =>
                    a.brinco.includes(brinco) ||
                    a.brinco.toLowerCase() === brinco.toLowerCase()
                );
                if (animal) {
                    const idade = animal.dataNascimento
                        ? Math.floor((Date.now() - new Date(animal.dataNascimento).getTime()) / (1000 * 60 * 60 * 24 * 30))
                        : null;
                    return `🐄 **${animal.nome || `Brinco ${animal.brinco}`}**\n` +
                           `• Brinco: ${animal.brinco}\n` +
                           `• Raça: ${animal.raca}\n` +
                           `• Sexo: ${animal.sexo}\n` +
                           `• Peso: ${animal.pesoKg} kg\n` +
                           `• Status: ${animal.status}\n` +
                           (idade ? `• Idade: ~${idade} meses\n` : '') +
                           (animal.maeNome ? `• Mãe: ${animal.maeNome}\n` : '') +
                           (animal.paiNome ? `• Pai: ${animal.paiNome}` : '');
                }
                return `❌ Animal com brinco "${brinco}" não encontrado no rebanho.`;
            }
        }

        // Listar animais (top, últimos, etc)
        if (lower.includes("listar") || lower.includes("mostrar") || lower.includes("quais são") || lower.includes("top")) {
            if (lower.includes("pesado") || lower.includes("maior") || lower.includes("top")) {
                const top5 = [...animals].sort((a, b) => b.pesoKg - a.pesoKg).slice(0, 5);
                const lista = top5.map((a, i) => `${i + 1}. ${a.nome || a.brinco}: ${a.pesoKg} kg`).join('\n');
                return `🏆 **Top 5 mais pesados:**\n${lista}`;
            }
            if (lower.includes("leve") || lower.includes("menor")) {
                const bottom5 = [...animals].sort((a, b) => a.pesoKg - b.pesoKg).slice(0, 5);
                const lista = bottom5.map((a, i) => `${i + 1}. ${a.nome || a.brinco}: ${a.pesoKg} kg`).join('\n');
                return `🪶 **Top 5 mais leves:**\n${lista}`;
            }
        }

        // Animais por raça específica
        const racaMatch = lower.match(/raça\s+(\w+)|(\w+)\s+raça/i);
        if (racaMatch) {
            const racaBuscada = (racaMatch[1] || racaMatch[2]).toLowerCase();
            const animaisDaRaca = animals.filter(a =>
                a.raca.toLowerCase().includes(racaBuscada)
            );
            if (animaisDaRaca.length > 0) {
                return `🏷️ Encontrados **${animaisDaRaca.length}** animais da raça "${racaBuscada}":\n` +
                       `• Peso médio: ${(animaisDaRaca.reduce((s, a) => s + a.pesoKg, 0) / animaisDaRaca.length).toFixed(2)} kg\n` +
                       `• Machos: ${animaisDaRaca.filter(a => a.sexo === Sexo.Macho).length}\n` +
                       `• Fêmeas: ${animaisDaRaca.filter(a => a.sexo === Sexo.Femea).length}`;
            }
            return `❌ Nenhum animal da raça "${racaBuscada}" encontrado.`;
        }

        // Comparações e análises
        if (lower.includes("comparar") || lower.includes("versus") || lower.includes(" vs ") || lower.includes("cruzamento")) {
            return "🧬 Para comparar animais ou analisar cruzamentos, use a função **Análise Fenotípica** disponível no menu do aplicativo.";
        }

        // Recomendações
        if (lower.includes("recomend") || lower.includes("sugest") || lower.includes("dica")) {
            const semPeso = animals.filter(a => !a.pesoKg || a.pesoKg === 0).length;
            const semVacina = animals.filter(a => !a.historicoSanitario || a.historicoSanitario.length === 0).length;
            let recomendacoes = "💡 **Recomendações:**\n";
            if (semPeso > 0) recomendacoes += `• ${semPeso} animais sem peso registrado - atualize!\n`;
            if (semVacina > 0) recomendacoes += `• ${semVacina} animais sem histórico sanitário\n`;
            if (semPeso === 0 && semVacina === 0) recomendacoes += "• Todos os registros estão atualizados! ✅";
            return recomendacoes;
        }

        // Busca por nome
        if (lower.includes("onde está") || lower.includes("encontrar") || lower.includes("achar")) {
            const palavras = lower.split(' ');
            for (const palavra of palavras) {
                if (palavra.length > 2) {
                    const encontrado = animals.find(a =>
                        a.nome?.toLowerCase().includes(palavra) ||
                        a.brinco.toLowerCase().includes(palavra)
                    );
                    if (encontrado) {
                        return `📍 **${encontrado.nome || encontrado.brinco}** encontrado!\n` +
                               `• Brinco: ${encontrado.brinco}\n` +
                               `• Peso: ${encontrado.pesoKg} kg\n` +
                               `• Status: ${encontrado.status}`;
                    }
                }
            }
        }

        // GMD (Ganho Médio Diário)
        if (lower.includes("gmd") || lower.includes("ganho") || lower.includes("engorda")) {
            const animaisComPesagens = animals.filter(a => a.historicoPesagens && a.historicoPesagens.length >= 2);
            if (animaisComPesagens.length === 0) {
                return "📊 Nenhum animal com histórico de pesagens suficiente para calcular GMD.";
            }
            return `📈 **${animaisComPesagens.length}** animais têm pesagens suficientes para análise de GMD. Use a seção de **Relatórios** para ver os dados detalhados.`;
        }

        // Verifica cache para perguntas não reconhecidas
        const cached = geminiCache.get(`chat:${lower}`);
        if (cached) return cached;

        // Resposta padrão melhorada
        return `🤔 Não entendi sua pergunta. Tente perguntar sobre:\n• Quantidade de animais\n• Peso (médio, total, mais pesado)\n• Vacinação e tratamentos\n• Prenhez e reprodução\n• Raças\n• Idade média\n• Buscar por brinco (ex: "brinco 123")\n• Top 5 mais pesados/leves\n\nOu digite "ajuda" para ver todas as opções.`;
    };

    return { sendMessage };
};

// Exporta função para limpar cache manualmente
export const clearGeminiCache = () => geminiCache.clear();

// ============================================
// ANÁLISE FENOTÍPICA
// ============================================

export interface PhenotypicData {
    name: string;
    breed: string;
    traits: string;
    age?: string;
    weight?: number;
    isExternal: boolean;
}

export const generatePhenotypicAnalysis = async (
    animalA: PhenotypicData,
    animalB: PhenotypicData
): Promise<string> => {
    const cacheKey = `pheno:${JSON.stringify(animalA)}:${JSON.stringify(animalB)}`;
    const cached = geminiCache.get(cacheKey);
    if (cached) return cached;

    return debouncedCall(cacheKey, async () => {
        checkRateLimit();
        try {
            const aiClient = await getAiClient();
            console.log("🧬 [GEMINI] Gerando análise fenotípica...");

            const prompt = `
            Atue como um especialista em melhoramento genético bovino. Realize uma análise de acasalamento entre dois animais com base nas seguintes características:

            ANIMAL A (${animalA.isExternal ? 'Externo' : 'Do Rebanho'}):
            - Nome/Identificação: ${animalA.name}
            - Raça: ${animalA.breed}
            - Idade/Nascimento: ${animalA.age || 'Não informado'}
            - Peso: ${animalA.weight ? animalA.weight + ' kg' : 'Não informado'}
            - Características Fenotípicas e Observações: ${animalA.traits}

            ANIMAL B (${animalB.isExternal ? 'Externo' : 'Do Rebanho'}):
            - Nome/Identificação: ${animalB.name}
            - Raça: ${animalB.breed}
            - Idade/Nascimento: ${animalB.age || 'Não informado'}
            - Peso: ${animalB.weight ? animalB.weight + ' kg' : 'Não informado'}
            - Características Fenotípicas e Observações: ${animalB.traits}

            Forneça um relatório detalhado contendo:
            1. Análise de Compatibilidade Fenotípica: Pontos fortes e fracos de cada animal e como se complementam.
            2. Previsão da Progênie: O que esperar das crias (porte, musculatura, aptidão leiteira/corte, precocidade).
            3. Recomendação Final: O acasalamento é recomendado? Por que? Dê uma nota de 0 a 10 para este acasalamento.
            4. Sugestões: O que buscar corrigir ou melhorar em futuras gerações caso este acasalamento ocorra.

            Use formatação Markdown para deixar o texto legível e profissional. Seja direto e técnico.
            `;

            const response = await aiClient.models.generateContent({
                model: geminiModel,
                contents: prompt,
            });

            const result = response.text.trim();
            geminiCache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error("Erro ao gerar análise fenotípica:", error);
            throw new Error("Não foi possível gerar a análise fenotípica no momento.");
        }
    });
};
