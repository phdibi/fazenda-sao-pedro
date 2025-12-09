/**
 * Constantes centralizadas da aplicação
 * Facilita manutenção e evita "números mágicos" espalhados pelo código
 */

// ============================================
// CACHE E SINCRONIZAÇÃO
// ============================================
export const CACHE_VERSION = 'v2';
export const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutos
export const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// ============================================
// UI E INTERAÇÃO
// ============================================
export const DEBOUNCE_DELAY_MS = 300;
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
