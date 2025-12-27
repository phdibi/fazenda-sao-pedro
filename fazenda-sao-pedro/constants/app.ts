/**
 * Constantes centralizadas da aplicação
 * Facilita manutenção e evita "números mágicos" espalhados pelo código
 */

// ============================================
// CACHE E SINCRONIZAÇÃO
// ============================================
export const CACHE_VERSION = 'v2';
export const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hora
// 🔧 OTIMIZAÇÃO: Aumentado de 5min para 30min para economizar leituras do Firestore
// Com listeners em tempo real, o auto-sync serve apenas como fallback
export const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos (antes era 5 minutos)

/**
 * 🔧 OTIMIZAÇÃO: Retorna intervalo de auto-sync baseado na hora do dia
 * - Horário comercial (6h-20h): sync mais frequente (15 min)
 * - Noite (20h-6h): sync menos frequente (1 hora)
 * - Fim de semana: sync menos frequente (30 min)
 */
export const getAutoSyncInterval = (): number => {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isBusinessHours = hour >= 6 && hour <= 20;

    if (isWeekend) {
        return 30 * 60 * 1000; // 30 minutos no fim de semana
    }

    if (isBusinessHours) {
        return 15 * 60 * 1000; // 15 minutos em horário comercial
    }

    return 60 * 60 * 1000; // 1 hora à noite
};

// ============================================
// FIREBASE LIMITS
// ============================================
export const QUERY_LIMITS = {
  INITIAL_LOAD: 100,      // Limite no carregamento inicial
  PAGINATION_SIZE: 25,    // Itens por página
  MAX_BATCH_WRITE: 500,   // Máximo do Firestore
};

export const ARCHIVED_COLLECTION_NAME = 'animals_archived';

// ============================================
// UI E INTERAÇÃO
// ============================================
// 🔧 OTIMIZAÇÃO: Aumentado de 300ms para 500ms para reduzir re-renders
export const DEBOUNCE_DELAY_MS = 500;
export const SWIPE_THRESHOLD = 80;
export const LONG_PRESS_DURATION_MS = 600;

// ============================================
// DASHBOARD E GRID
// ============================================
export const CARD_HEIGHT = 280;
export const CARD_GAP = 12;
export const VIRTUALIZATION_THRESHOLD = 50; // Animais para ativar virtualização
export const GRID_OVERSCAN_ROWS = 2;

// ============================================
// RATE LIMITING (Gemini API)
// ============================================
export const RATE_LIMIT = {
  calls: 15,
  windowMs: 60 * 1000, // 1 minuto
} as const;

// ============================================
// GEMINI CACHE
// ============================================
export const GEMINI_CACHE = {
  maxAge: 30 * 60 * 1000, // 30 minutos
  maxEntries: 50,
} as const;

// ============================================
// LAZY LOADING
// ============================================
export const INTERSECTION_OBSERVER = {
  rootMargin: '100px',
  threshold: 0,
} as const;

// ============================================
// ANIMAIS E CLASSIFICAÇÕES
// ============================================
export const AGE_RANGES = {
  bezerro: { min: 0, max: 6 },      // 0-6 meses
  jovem: { min: 7, max: 12 },       // 7-12 meses
  novilho: { min: 13, max: 24 },    // 13-24 meses
  adulto: { min: 25, max: Infinity }, // 25+ meses
} as const;

export const WEIGHT_RANGES = {
  leve: { min: 0, max: 199 },
  medio: { min: 200, max: 400 },
  pesado: { min: 401, max: Infinity },
} as const;

export const GMD_THRESHOLDS = {
  top: 1.0,      // >= 1.0 kg/dia = top performer
  under: 0.5,   // < 0.5 kg/dia = underperformer
} as const;

// ============================================
// RECENT ACTIVITY
// ============================================
export const RECENT_WEIGHING_DAYS = 30;

// ============================================
// RESPONSIVE BREAKPOINTS (Tailwind)
// ============================================
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// ============================================
// GRID COLUMNS POR BREAKPOINT
// ============================================
export const GRID_COLUMNS = {
  default: 2,
  sm: 3,
  md: 4,
  lg: 5,
  xl: 6,
  '2xl': 7,
} as const;

// ============================================
// TOAST NOTIFICATIONS
// ============================================
export const TOAST = {
  maxVisible: 5,
  durationDefault: 4000,
  durationError: 6000,
  durationSuccess: 3000,
} as const;

// ============================================
// IMAGENS
// ============================================
export const IMAGE_COMPRESSION = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.8,
  format: 'image/webp',
  thumbnailSize: 200,
  thumbnailQuality: 0.6,
} as const;

// ============================================
// PESOS & PREDIÇÃO
// ============================================
export const WEIGHT_VALIDATION = {
  minKg: 20,
  maxKg: 1500,
  avgDailyGain: 0.8,
  defaultPredictionDays: 30,
} as const;

// ============================================
// MENSAGENS PADRÃO
// ============================================
export const MESSAGES = {
  LOADING: 'Carregando...',
  SAVING: 'Salvando...',
  ERROR_GENERIC: 'Ocorreu um erro. Tente novamente.',
  ERROR_NETWORK: 'Erro de conexão. Verifique sua internet.',
  ERROR_AUTH: 'Sessão expirada. Faça login novamente.',
  SUCCESS_SAVE: 'Salvo com sucesso!',
  SUCCESS_DELETE: 'Excluído com sucesso!',
  CONFIRM_DELETE: 'Tem certeza que deseja excluir?',
  RATE_LIMIT: 'Limite de requisições atingido. Aguarde um momento.',
} as const;

// ============================================
// ANIMAÇÃO & UI
// ============================================
export const ANIMATION = {
  transitionDuration: 200,
  enterDuration: 300,
  exitDuration: 200,
  loadingDelay: 200,
} as const;

// ============================================
// FEATURES FLAGS
// ============================================
export const DEBUG = {
  enabled: import.meta.env.DEV,
  perfLogging: import.meta.env.DEV,
  simulatedLatency: 0,
} as const;
