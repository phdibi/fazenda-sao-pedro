// 🔧 OTIMIZAÇÃO: Dynamic import do Gemini SDK
// O SDK só é carregado quando realmente necessário, economizando ~200KB no bundle inicial
import { Animal, MedicationAdministration, Raca, Sexo, ComprehensiveReport, MonthlyMedicationUsage, MedicationUsageDetail, DamPerformanceData } from "../types";
import { geminiRateLimiter, RateLimitError, isRateLimitError } from "./rateLimiter";

// Tipos para o SDK (evita importar o pacote inteiro)
type GoogleGenAI = any;
type Type = any;

// --- LAZY, FAULT-TOLERANT INITIALIZATION COM DYNAMIC IMPORT ---
// O cliente de IA é inicializado apenas quando necessário pela primeira vez.
// Isso evita que o aplicativo carregue ~200KB do SDK no bundle inicial.
let ai: GoogleGenAI | null = null;
let TypeEnum: Type | null = null;

const getAiClient = async (): Promise<GoogleGenAI> => {
    if (ai) {
        return ai;
    }
    try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("A variável de ambiente VITE_GEMINI_API_KEY não foi encontrada.");
        }

        // 🔧 DYNAMIC IMPORT: Carrega SDK apenas quando necessário
        console.log('📦 [GEMINI] Carregando SDK dinamicamente...');
        const { GoogleGenAI, Type } = await import('@google/genai');
        TypeEnum = Type;

        ai = new GoogleGenAI({ apiKey });
        console.log('✅ [GEMINI] SDK carregado com sucesso');
        return ai;
    } catch (e) {
        console.error("Falha ao inicializar o cliente Gemini:", e);
        throw new Error("Não foi possível conectar à IA do Gemini. Verifique se a chave de API está configurada corretamente no ambiente de execução.");
    }
};

// Helper para obter Type enum após SDK carregado
const getTypeEnum = async (): Promise<Type> => {
    if (!TypeEnum) {
        await getAiClient(); // Isso carrega o TypeEnum também
    }
    return TypeEnum!;
};

const geminiModel = 'gemini-2.5-flash';

// --- Função auxiliar para chamadas com rate limiting ---
const callWithRateLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
        await geminiRateLimiter.acquire();
        return await fn();
    } catch (error) {
        if (isRateLimitError(error)) {
            throw error; // Propaga erro de rate limit
        }
        throw error;
    }
};

// --- Schemas for structured data extraction (criados dinamicamente) ---
const getMedicationSchema = async () => {
    const Type = await getTypeEnum();
    return {
        type: Type.OBJECT,
        properties: {
            medicamento: { type: Type.STRING, description: 'Nome do medicamento' },
            dose: { type: Type.NUMBER, description: 'Dosagem numérica' },
            unidade: { type: Type.STRING, description: 'Unidade da dose (ml, mg, dose)', enum: ['ml', 'mg', 'dose'] },
            motivo: { type: Type.STRING, description: 'Motivo da aplicação' }
        },
    };
};

const getAnimalSchema = async () => {
    const Type = await getTypeEnum();
    return {
        type: Type.OBJECT,
        properties: {
            brinco: { type: Type.STRING, description: 'Número do brinco do animal' },
            nome: { type: Type.STRING, description: 'Nome do animal' },
            raca: { type: Type.STRING, description: 'Raça do animal', enum: Object.values(Raca) },
            sexo: { type: Type.STRING, description: 'Sexo do animal', enum: Object.values(Sexo) },
            dataNascimento: { type: Type.STRING, description: 'Data de nascimento no formato AAAA-MM-DD' },
            pesoKg: { type: Type.NUMBER, description: 'Peso do animal em quilogramas' },
            maeNome: { type: Type.STRING, description: 'Nome ou brinco da mãe' },
            paiNome: { type: Type.STRING, description: 'Nome ou brinco do pai' }
        },
    };
};

// --- MOCK IMPLEMENTATION (for features not reported as bugs) ---
const mockApiCall = <T,>(data: T, delay = 1500): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(data), delay));


// --- REAL GEMINI FUNCTIONS ---

export const structureMedicalDataFromText = async (text: string): Promise<Partial<MedicationAdministration>> => {
  return callWithRateLimit(async () => {
    try {
      const aiClient = await getAiClient();
      const medicationSchema = await getMedicationSchema();
      console.log("Calling Gemini to structure medical text:", text);
      const response = await aiClient.models.generateContent({
        model: geminiModel,
        contents: `Extraia as informações de medicação do seguinte texto: "${text}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: medicationSchema,
        },
      });

      const jsonString = response.text.trim();
      return JSON.parse(jsonString) as Partial<MedicationAdministration>;

    } catch (error) {
      console.error("Error structuring medical data with Gemini:", error);
      if (isRateLimitError(error)) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("Não foi possível conectar")) {
        throw error;
      }
      throw new Error("A IA não conseguiu processar o comando de medicação.");
    }
  });
};

export const structureAnimalDataFromText = async (text: string): Promise<Partial<Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>>> => {
  return callWithRateLimit(async () => {
    try {
      const aiClient = await getAiClient();
      const animalSchema = await getAnimalSchema();
      console.log("Calling Gemini to structure animal registration text:", text);
      const response = await aiClient.models.generateContent({
        model: geminiModel,
        contents: `Extraia as informações de registro do animal do seguinte texto: "${text}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: animalSchema,
        },
      });

      const jsonString = response.text.trim();
      let parsedData = JSON.parse(jsonString);

      if (parsedData.dataNascimento && typeof parsedData.dataNascimento === 'string') {
        parsedData.dataNascimento = new Date(parsedData.dataNascimento + 'T00:00:00');
      }

      return parsedData as Partial<Omit<Animal, 'id' | 'fotos' | 'historicoSanitario' | 'historicoPesagens'>>;

    } catch (error) {
      console.error("Error structuring animal data with Gemini:", error);
      if (isRateLimitError(error)) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("Não foi possível conectar")) {
        throw error;
      }
      throw new Error("A IA não conseguiu processar o comando de registro de animal.");
    }
  });
};


// --- REMAINING MOCKS for other functionalities ---

export const generateComprehensiveReport = async (
  animals: Animal[], 
  dateRange: { start: Date; end: Date }
): Promise<ComprehensiveReport> => {
  console.log("Simulating Gemini call to generate a comprehensive report for date range:", dateRange);

  // --- SANITARY REPORT ---
  const filteredAnimalsData = animals.map(animal => ({
    ...animal,
    historicoSanitario: animal.historicoSanitario.filter(med => {
      const medDate = new Date(med.dataAplicacao);
      return medDate >= dateRange.start && medDate <= dateRange.end;
    }),
  }));
  const medicatedAnimals = filteredAnimalsData.filter(a => a.historicoSanitario.length > 0);
  
  const sanitaryReport = (() => {
      if (medicatedAnimals.length === 0) {
        return {
            topTreatedAnimals: [],
            medicationUsage: [],
            seasonalAnalysis: [],
            reasonAnalysis: [],
            recommendations: "Nenhuma atividade sanitária registrada no período selecionado. O rebanho parece saudável.",
        };
      }
      const sortedAnimals = medicatedAnimals.map(a => ({ animalId: a.id, brinco: a.brinco, nome: a.nome || 'N/A', treatmentCount: a.historicoSanitario.length })).sort((a, b) => b.treatmentCount - a.treatmentCount).slice(0, 20);
      const medicationData: { [medName: string]: { total: number; months: { [monthKey: string]: number } } } = {};
      const extractMedNames = (med: any): string[] => { if (med.medicamentos && Array.isArray(med.medicamentos)) { return med.medicamentos.map((m: any) => m.medicamento).filter(Boolean); } return med.medicamento ? [med.medicamento] : []; };
      medicatedAnimals.forEach(animal => { animal.historicoSanitario.forEach(med => { const d = new Date(med.dataAplicacao); const monthYearKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; extractMedNames(med).forEach(medName => { if (!medicationData[medName]) { medicationData[medName] = { total: 0, months: {} }; } medicationData[medName].total += 1; medicationData[medName].months[monthYearKey] = (medicationData[medName].months[monthYearKey] || 0) + 1; }); }); });
      const medicationUsage: MedicationUsageDetail[] = Object.entries(medicationData).map(([medName, data]) => { const monthlyUsage = Object.entries(data.months).map(([key, value]) => { const [year, month] = key.split('-'); const label = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' }); return { label, value, key }; }).sort((a, b) => a.key.localeCompare(b.key)).map(({ label, value }) => ({ label, value })); return { label: medName, value: data.total, monthlyUsage }; }).sort((a, b) => b.value - a.value);
      const reasonCounts: { [key: string]: number } = {};
      medicatedAnimals.forEach(animal => { animal.historicoSanitario.forEach(med => { reasonCounts[med.motivo] = (reasonCounts[med.motivo] || 0) + 1; }); });
      const reasonAnalysis = Object.entries(reasonCounts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
      const monthData: { [key: string]: { total: number; meds: { [medName: string]: number } } } = {};
      medicatedAnimals.forEach(animal => { animal.historicoSanitario.forEach(med => { const d = new Date(med.dataAplicacao); const monthYearKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (!monthData[monthYearKey]) { monthData[monthYearKey] = { total: 0, meds: {} }; } monthData[monthYearKey].total += 1; extractMedNames(med).forEach(medName => { monthData[monthYearKey].meds[medName] = (monthData[monthYearKey].meds[medName] || 0) + 1; }); }); });
      const seasonalAnalysis: MonthlyMedicationUsage[] = Object.entries(monthData).map(([key, data]) => { const [year, month] = key.split('-'); const label = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' }); const topMedications = Object.entries(data.meds).map(([medLabel, medValue]) => ({ label: medLabel, value: medValue })).sort((a, b) => b.value - a.value).slice(0, 5); return { label, value: data.total, medications: topMedications, key }; }).sort((a, b) => a.key.localeCompare(b.key)).map(({label, value, medications}) => ({label, value, medications}));
      const recommendations = `Com base nos dados do período, observamos uma concentração de tratamentos por **${reasonAnalysis[0]?.label || 'motivos diversos'}**. O medicamento mais utilizado foi **${medicationUsage[0]?.label || 'nenhum em particular'}**. Recomenda-se atenção especial ao animal com brinco **${sortedAnimals[0]?.brinco || 'N/A'}**, que recebeu o maior número de tratamentos. Avalie a possibilidade de ajustar os protocolos preventivos durante os meses de maior incidência para otimizar a saúde do rebanho.`;
      
      return { topTreatedAnimals: sortedAnimals, medicationUsage, seasonalAnalysis, reasonAnalysis, recommendations };
  })();

  // --- REPRODUCTIVE REPORT ---
  const reproductiveReport = (() => {
    const damsWithProgeny = animals.filter(
        a => a.sexo === Sexo.Femea && a.historicoProgenie && a.historicoProgenie.length > 0
    );

    const performanceData: DamPerformanceData[] = damsWithProgeny.map(dam => {
        const progeny = dam.historicoProgenie!;
        const offspringCount = progeny.length;

        const calcAvg = (key: 'birthWeightKg' | 'weaningWeightKg' | 'yearlingWeightKg') => {
            const weights = progeny.map(p => p[key]).filter(w => w != null && w > 0) as number[];
            if (weights.length === 0) return undefined;
            const sum = weights.reduce((acc, w) => acc + w, 0);
            return sum / weights.length;
        };

        return {
            damId: dam.id,
            damBrinco: dam.brinco,
            damNome: dam.nome,
            offspringCount,
            avgBirthWeight: calcAvg('birthWeightKg'),
            avgWeaningWeight: calcAvg('weaningWeightKg'),
            avgYearlingWeight: calcAvg('yearlingWeightKg'),
        };
    });
    
    performanceData.sort((a, b) => { if (b.offspringCount !== a.offspringCount) { return b.offspringCount - a.offspringCount; } return (b.avgWeaningWeight || 0) - (a.avgWeaningWeight || 0); });
    const topDam = performanceData[0];
    const recommendations = topDam
        ? `A fêmea **${topDam.damNome || `de brinco ${topDam.damBrinco}`}** demonstra ser a matriz mais produtiva, com **${topDam.offspringCount} crias** registradas e uma média de peso ao desmame de **${topDam.avgWeaningWeight?.toFixed(2) || 'N/A'} kg**. Considere utilizar a genética desta matriz como base para futuras seleções. Monitore fêmeas com poucas crias ou baixo desempenho de desmame para decisões de descarte.`
        : "Não há dados suficientes sobre a progênie para gerar recomendações reprodutivas. Continue registrando os nascimentos e pesos para obter insights valiosos.";
    
    return { performanceData, recommendations };
  })();
  
  // 4. Assemble the final report object
  const report: ComprehensiveReport = {
    sanitary: sanitaryReport,
    reproductive: reproductiveReport,
    turnWeight: {
      averageWeight: 0,
      totalAnimals: 0,
      topPerformers: [],
      breedAnalysis: [],
      recommendations: 'Sem dados de peso de virada disponíveis.'
    }
  };

  return mockApiCall(report, 2500);
};

// --- CHATBOT MOCK ---
export const startChat = async (animals: Animal[]) => {
    console.log("Simulating starting a chat session with Gemini.");
    
    // In a real scenario, you'd pass a system instruction or initial context here.
    // For this mock, we'll just use the animal data inside the sendMessage function.

    const sendMessage = (message: string): Promise<string> => {
        const lowerCaseMessage = message.toLowerCase();
        
        // Simple keyword-based responses to simulate AI
        if (lowerCaseMessage.includes("olá") || lowerCaseMessage.includes("oi")) {
            return mockApiCall("Olá! Sou seu assistente de manejo de rebanho. Como posso ajudar?", 500);
        }
        if (lowerCaseMessage.includes("quantos")) {
            if (lowerCaseMessage.includes("macho")) {
                const count = animals.filter(a => a.sexo === Sexo.Macho).length;
                return mockApiCall(`Você tem ${count} machos no rebanho.`);
            }
            if (lowerCaseMessage.includes("fêmea")) {
                const count = animals.filter(a => a.sexo === Sexo.Femea).length;
                return mockApiCall(`Você tem ${count} fêmeas no rebanho.`);
            }
            return mockApiCall(`Atualmente, você tem ${animals.length} animais cadastrados.`);
        }
        if (lowerCaseMessage.includes("peso médio")) {
            const totalWeight = animals.reduce((sum, animal) => sum + animal.pesoKg, 0);
            const avgWeight = totalWeight / animals.length;
            return mockApiCall(`O peso médio do rebanho é de ${avgWeight.toFixed(2)} kg.`);
        }
        if (lowerCaseMessage.includes("mais pesado")) {
            const heaviest = animals.reduce((max, animal) => animal.pesoKg > max.pesoKg ? animal : max, animals[0]);
            return mockApiCall(`O animal mais pesado é ${heaviest.nome || `o de brinco ${heaviest.brinco}`}, pesando ${heaviest.pesoKg} kg.`);
        }

        return mockApiCall("Desculpe, não entendi a pergunta. Poderia tentar de outra forma?", 1000);
    };

    // The real API returns a chat session object. We'll mock that.
    return Promise.resolve({
        sendMessage
    });
};