// This file no longer uses module imports for Firebase.
// Instead, it relies on the Firebase scripts being loaded globally in index.html,
// making the `firebase` object available on the `window`.

// ============================================
// INTERNAL STATE
// ============================================
let _globalFirebase: any = null;
let _app: any = null;
let _auth: any = null;
let _db: any = null;
let _storage: any = null;
let _googleProvider: any = null;
let _Timestamp: any = null;
let _FieldValue: any = null;
let _initialized = false;

let initPromise: Promise<void> | null = null;

// ============================================
// INITIALIZATION
// ============================================
async function initializeFirebase(): Promise<void> {
  if (_initialized) return;

  // Wait for Firebase to be ready
  if ((window as any).__FIREBASE_READY__) {
    await (window as any).__FIREBASE_READY__;
  }

  _globalFirebase = (window as any).firebase;

  try {
    if (!_globalFirebase) {
      throw new Error("Firebase não carregado");
    }

    const firebaseConfig = (window as any).__FIREBASE_CONFIG__ || {};

    if (firebaseConfig?.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY' && firebaseConfig.projectId) {
      if (!_globalFirebase.apps.length) {
        _app = _globalFirebase.initializeApp(firebaseConfig);
      } else {
        _app = _globalFirebase.app();
      }

      _auth = _globalFirebase.auth();
      _db = _globalFirebase.firestore();
      _storage = _globalFirebase.storage();
      _googleProvider = new _globalFirebase.auth.GoogleAuthProvider();
      _Timestamp = _globalFirebase.firestore.Timestamp;
      _FieldValue = _globalFirebase.firestore.FieldValue;
      _initialized = true;
    }
  } catch (error) {
    console.error("FALHA na inicialização do Firebase:", error);
  }
}

// ============================================
// PUBLIC API
// ============================================

export async function ensureFirebaseReady(): Promise<boolean> {
  if (!initPromise) {
    initPromise = initializeFirebase();
  }
  await initPromise;
  return _initialized;
}

// Getter functions - sempre retornam o valor atual
export function getAuth() { return _auth; }
export function getDb() { return _db; }
export function getStorage() { return _storage; }
export function getGoogleProvider() { return _googleProvider; }
export function getTimestamp() { return _Timestamp; }
export function getFieldValue() { return _FieldValue; }

// ============================================
// OBJETO COM GETTERS DINÂMICOS
// ============================================
export const firebaseServices = {
  get firebase() { return _globalFirebase; },
  get auth() { return _auth; },
  get db() { return _db; },
  get storage() { return _storage; },
  get googleProvider() { return _googleProvider; },
  get Timestamp() { return _Timestamp; },
  get FieldValue() { return _FieldValue; },
  get isInitialized() { return _initialized; },
};

// ============================================
// EXPORTS LEGADOS (para compatibilidade)
// ============================================
// AVISO: Estes exports capturam o valor no momento da avaliação do módulo.
// Para garantir que funcionem, o código consumidor deve:
// 1. Chamar ensureFirebaseReady() antes de usar
// 2. OU usar firebaseServices.auth em vez de auth diretamente
// 3. OU usar as funções getter: getAuth(), getDb(), etc.

export const firebase = _globalFirebase;
export const auth = _auth;
export const db = _db;
export const storage = _storage;
export const googleProvider = _googleProvider;
export const Timestamp = _Timestamp;
export const FieldValue = _FieldValue;

// Initialize immediately
initPromise = initializeFirebase();
