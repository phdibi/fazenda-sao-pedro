// This file no longer uses module imports for Firebase.
// Instead, it relies on the Firebase scripts being loaded globally in index.html,
// making the `firebase` object available on the `window`.
// This is a robust strategy to prevent module resolution conflicts.

// Cast window to `any` to access the globally loaded firebase object.
const globalFirebase = (window as any).firebase;

let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;
let googleProvider: any = null;
let Timestamp: any = null;
let FieldValue: any = null;

try {
  if (!globalFirebase) {
    throw new Error("A biblioteca Firebase não foi carregada. Verifique as tags <script> em seu index.html.");
  }

  // Your web app's Firebase configuration is read from the window object.
  // This is set in the <script> tag in index.html.
  const firebaseConfig = (window as any).__FIREBASE_CONFIG__ || {};

  // CRITICAL FIX: Check for a valid config BEFORE initializing.
  // We check for apiKey and projectId as a baseline for a valid config.
  if (firebaseConfig?.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY' && firebaseConfig.projectId) {
    // Initialize Firebase ONLY if the config is valid.
    if (!globalFirebase.apps.length) {
      app = globalFirebase.initializeApp(firebaseConfig);
    } else {
      app = globalFirebase.app(); // Get the default app if already initialized
    }

    // Get all required services from the now-initialized global object.
    auth = globalFirebase.auth();
    db = globalFirebase.firestore();
    storage = globalFirebase.storage();
    googleProvider = new globalFirebase.auth.GoogleAuthProvider();
    // Force account selection prompt
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    Timestamp = globalFirebase.firestore.Timestamp;
    FieldValue = globalFirebase.firestore.FieldValue;
  } else {
    // This case handles missing config or placeholder values.
    // It's not an error, but a state the UI needs to handle.
    console.warn("Configuração do Firebase não encontrada ou incompleta em window.__FIREBASE_CONFIG__. O aplicativo será executado em modo de erro para solicitar a configuração correta.");
  }
} catch (error) {
    // This CATCH block is the most important change. It prevents a top-level crash.
    // If initializeApp or any service call (like .auth()) fails due to an invalid
    // but present config, this will catch it and prevent the black screen.
    console.error("FALHA CRÍTICA na inicialização do Firebase:", error);
    console.error("Isso geralmente é causado por um objeto de configuração inválido (apiKey, authDomain, etc.) em index.html.");
    // Ensure all services are null so the UI can react correctly.
    app = null;
    auth = null;
    db = null;
    storage = null;
}


// Re-export the global object under the name 'firebase'.
const firebase = globalFirebase;

// Helper object to match the imports expected by other files (e.g., App.tsx)
const firebaseServices = {
    get auth() { return auth; },
    get db() { return db; },
    get storage() { return storage; },
    get Timestamp() { return Timestamp; },
    get FieldValue() { return FieldValue; }
};

// Export everything for use throughout the app.
// If initialization failed, some of these will be null.
export {
    firebase,
    auth,
    db,
    storage,
    googleProvider,
    Timestamp,
    FieldValue,
    firebaseServices
};
