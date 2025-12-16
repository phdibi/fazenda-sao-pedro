import './index.css';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppUser } from './types';
import { firebaseServices, ensureFirebaseReady } from './services/firebase';
import Spinner from './components/common/Spinner';
import ErrorBoundary from './components/ErrorBoundary';

// ============================================
// HANDLER GLOBAL PARA ERROS DO FIREBASE POPUP
// ============================================
// O Firebase Auth tem um bug onde erros de popup/COOP causam
// "Cannot access 'X' before initialization" que não podem ser
// capturados por try/catch. Este handler global ignora esses erros.
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  // Ignora erros de TDZ do Firebase popup
  if (msg.includes("Cannot access") && msg.includes("before initialization")) {
    console.warn('[Firebase Popup Bug] Erro ignorado:', msg);
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason) || '';
  // Ignora erros de TDZ do Firebase popup
  if (msg.includes("Cannot access") && msg.includes("before initialization")) {
    console.warn('[Firebase Popup Bug] Promise rejection ignorada:', msg);
    event.preventDefault();
    return false;
  }
});


// --- GOOGLE AUTHENTICATION ---
// O sistema de autenticação anônima foi substituído por "Login com Google".
// Isso permite que os usuários tenham contas persistentes e acessem seus
// dados de múltiplos dispositivos.

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.022,35.332,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
);


const LoginScreen = ({ onLogin, initialError }: { onLogin: () => Promise<void>; initialError: string | null }) => {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(initialError);

    useEffect(() => {
        setLoginError(initialError);
    }, [initialError]);

    const handleLoginClick = async () => {
        setIsLoggingIn(true);
        setLoginError(null);
        try {
            await onLogin();
            // Com o método de redirecionamento, a página irá navegar para o provedor de login.
            // O spinner será exibido até que a navegação ocorra.
        } catch (error: any) {
            // Este bloco captura erros que ocorrem *antes* do redirecionamento.
            if (error.code === 'auth/operation-not-allowed') {
                setLoginError("Login com Google não está ativado. Por favor, ative-o no seu Console do Firebase em Authentication > Sign-in method.");
            } else {
                console.error("Login Error:", error);
                setLoginError("Falha no login. Verifique o console para mais detalhes ou tente novamente.");
            }
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen bg-base-900 flex flex-col justify-center items-center text-white p-8 text-center">
            {/* Logo do aplicativo em vez do ícone de estrelas */}
            <img 
                src="/logo.png" 
                alt="Fazenda+" 
                className="h-24 w-auto mb-6 cow-logo"
            />
            <h1 className="text-4xl font-bold">Fazenda+</h1>
            <p className="text-base-300 mt-2">Gerencie seu rebanho com inteligência.</p>
            <div className="mt-12">
                <button
                    onClick={handleLoginClick}
                    disabled={isLoggingIn}
                    className="inline-flex items-center bg-white text-gray-700 font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                    {isLoggingIn ? <Spinner /> : <GoogleIcon />}
                    <span>Entrar com Google</span>
                </button>
                {loginError && (
                    <div className="text-red-400 bg-red-900/30 border border-red-400/50 p-3 rounded-md mt-6 max-w-md mx-auto text-sm">
                        <p className="font-bold">Ocorreu um problema</p>
                        <p>{loginError}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- VERIFICAÇÃO DE AMBIENTE ---
// O Firebase Auth (web) depende de duas condições principais do ambiente:
// 1. Acesso ao Web Storage (localStorage/sessionStorage).
// 2. Execução sob um protocolo suportado (http:, https:, chrome-extension:).
// Esta função verifica ambas as condições antes de qualquer tentativa de autenticação.
const isFirebaseAuthSupported = (): { supported: boolean; reason: string | null } => {
    // 1. Verificação do Web Storage
    try {
        const key = `__firebase_auth_test__`;
        window.localStorage.setItem(key, 'test');
        window.localStorage.removeItem(key);
    } catch (e) {
        return {
            supported: false,
            reason: "O Web Storage do seu navegador está desativado ou não é suportado. O sistema de login precisa dele para funcionar. Verifique as configurações de privacidade do seu navegador ou tente em uma janela normal."
        };
    }

    // 2. Verificação do Protocolo
    const supportedProtocols = ['http:', 'https:', 'chrome-extension:'];
    const currentProtocol = window.location.protocol;
    if (!supportedProtocols.includes(currentProtocol)) {
        return {
            supported: false,
            reason: `O protocolo do seu ambiente (${currentProtocol}) não é suportado. O aplicativo deve ser executado a partir de um servidor web (http ou https), e não como um arquivo local ('file:').`
        };
    }

    return { supported: true, reason: null };
};

const validateFirebaseConfig = (): { valid: boolean; reason: string | null } => {
    const config = (window as any).__FIREBASE_CONFIG__;

    if (!config) {
        return {
            valid: false,
            reason: 'A configuração do Firebase não foi carregada. Verifique a tag <script> em index.html.',
        };
    }

    if (!config.apiKey || config.apiKey === 'YOUR_API_KEY' || !config.projectId) {
        return {
            valid: false,
            reason: 'A configuração do Firebase está incompleta. Atualize window.__FIREBASE_CONFIG__ em index.html.',
        };
    }

    return { valid: true, reason: null };
};

const RootComponent = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firebaseConfigValid, setFirebaseConfigValid] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const initializeApp = async () => {
      // --- 1. Verificação de Ambiente Completa (Storage e Protocolo) ---
      const envCheck = isFirebaseAuthSupported();
      if (!envCheck.supported) {
          if (isMounted) {
            setEnvironmentError(envCheck.reason);
            setLoading(false);
          }
          return;
      }

      // --- 2. Verificação de Configuração do Firebase ---
      const firebaseConfigStatus = validateFirebaseConfig();
      if (!firebaseConfigStatus.valid) {
          if (isMounted) {
            setError(firebaseConfigStatus.reason);
            setLoading(false);
          }
          return;
      }

      if (isMounted) {
        setFirebaseConfigValid(true);
      }

      // --- 3. Aguarda Firebase estar pronto ---
      try {
        await ensureFirebaseReady();
      } catch (e) {
        console.error("Erro ao inicializar Firebase:", e);
      }

      // Usa o getter dinâmico para acessar auth após inicialização
      const auth = firebaseServices.auth;

      if (!auth) {
          if (isMounted) {
            setError(
                "A configuração do Firebase é inválida ou está ausente. " +
                "O aplicativo não pode se conectar ao banco de dados."
            );
            setLoading(false);
          }
          return;
      }

      // --- 4. Processa resultado de redirect (se houver) ---
      // Isso é chamado quando o usuário retorna de um login via redirect
      try {
        const result = await auth.getRedirectResult();
        // O resultado será processado pelo onAuthStateChanged
        if (result?.user) {
          console.log("Redirect login processado:", result.user.email);
        }
      } catch (error: any) {
        // Ignora erros de "no redirect" - isso é normal
        if (error.code !== 'auth/null-user') {
          console.error("Erro no redirect:", error);
        }
      }

      // --- 5. Monitora mudanças no estado de autenticação ---
      unsubscribe = auth.onAuthStateChanged((firebaseUser: any) => {
        if (!isMounted) return;

        if (firebaseUser) {
          const appUser: AppUser = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Usuário',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          };
          setUser(appUser);
          setError(null);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    };

    initializeApp();

    return () => {
        isMounted = false;
        if (unsubscribe) {
          unsubscribe();
        }
    };
  }, []);

  // ✅ USA POPUP em localhost, REDIRECT em produção
  // Redirect requer domínio autorizado no Firebase; popup funciona sempre
  const handleGoogleLogin = async () => {
      // Garante que Firebase está pronto antes de tentar login
      await ensureFirebaseReady();

      // Usa getters dinâmicos para acessar após inicialização
      const auth = firebaseServices.auth;
      const googleProvider = firebaseServices.googleProvider;

      if (!auth || !googleProvider) {
          throw new Error("Autenticação não inicializada. Verifique a configuração do Firebase.");
      }

      // Em localhost usa popup (não precisa de domínio autorizado)
      // Em produção usa redirect (mais confiável com COOP)
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';

      if (isLocalhost) {
          // Popup funciona em localhost sem precisar autorizar domínio
          await auth.signInWithPopup(googleProvider);
      } else {
          // Redirect é mais confiável em produção (Vercel tem COOP)
          await auth.signInWithRedirect(googleProvider);
      }
  };

  // --- RENDERIZAÇÃO ---

  const renderEnvironmentErrorSolutions = (errorMsg: string) => {
      const isProtocolError = errorMsg.includes("protocolo") || errorMsg.includes("file:");
      const isStorageError = errorMsg.includes("Web Storage");

      if (isProtocolError) {
          return (
               <div className="mt-6 bg-base-800 p-6 rounded-lg text-left max-w-3xl w-full">
                  <p className="font-bold text-lg mb-2">Como Resolver:</p>
                  <p className="text-base-200">
                      Este erro geralmente ocorre ao abrir o arquivo <code className="bg-base-700 px-1 rounded text-sm">index.html</code> diretamente no navegador. Para que a autenticação funcione, o aplicativo precisa ser servido por um servidor web.
                  </p>
                  <p className="font-bold text-lg mt-4 mb-2">Opção Rápida (com VS Code):</p>
                  <ol className="list-decimal list-inside space-y-2 text-base-200">
                    <li>Instale a extensão <strong className="text-base-100">"Live Server"</strong> no Visual Studio Code.</li>
                    <li>Abra a pasta do projeto no VS Code.</li>
                    <li>Clique com o botão direito no arquivo <code className="bg-base-700 px-1 rounded text-sm">index.html</code> e selecione <strong className="text-base-100">"Open with Live Server"</strong>.</li>
                    <li>Uma nova aba do navegador abrirá com o endereço correto (começando com <code className="bg-base-700 px-1 rounded text-sm">http://127.0.0.1...</code>). Use esta nova aba.</li>
                  </ol>
              </div>
          );
      }

      if (isStorageError) {
          return (
               <div className="mt-6 bg-base-800 p-6 rounded-lg text-left max-w-3xl w-full">
                  <p className="font-bold text-lg mb-2">Possíveis Causas e Soluções:</p>
                  <ol className="list-decimal list-inside space-y-2 text-base-200">
                    <li><strong className="text-base-100">Modo de Navegação Privada/Anônima:</strong> Alguns navegadores bloqueiam o armazenamento de dados. Tente usar uma janela normal.</li>
                    <li><strong className="text-base-100">Configurações do Navegador:</strong> Verifique se as configurações de privacidade (ex: Chrome, Firefox, Safari) não estão bloqueando "cookies e dados de sites de terceiros".</li>
                    <li><strong className="text-base-100">Extensões de Navegador:</strong> Extensões de bloqueio de anúncios ou de privacidade podem desativar o Web Storage. Tente desativá-las temporariamente.</li>
                    <li><strong className="text-base-100">Navegador Desatualizado:</strong> Garanta que seu navegador está atualizado para a versão mais recente.</li>
                </ol>
              </div>
          );
      }

      return null;
  }

  if (environmentError) {
      return (
        <div className="min-h-screen bg-base-900 flex flex-col justify-center items-center text-white p-8 text-center">
           <h2 className="text-2xl font-bold text-red-400 mb-4">
              Ambiente Incompatível
           </h2>
          <p className="max-w-2xl">
              {environmentError}
          </p>
          {renderEnvironmentErrorSolutions(environmentError)}
        </div>
      );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-900 flex flex-col justify-center items-center text-white">
        <Spinner />
        <p className="mt-4">Autenticando sessão...</p>
      </div>
    );
  }

  if (error) {
    const isFirebaseConfigError = error?.includes("configuração do Firebase é inválida");

    return (
      <div className="min-h-screen bg-base-900 flex flex-col justify-center items-center text-white p-8 text-center">
         <h2 className="text-2xl font-bold text-red-400 mb-4">
            {isFirebaseConfigError ? "Ação Necessária: Configuração" : "Erro de Conexão"}
         </h2>
        <p className="max-w-2xl">
            {error || "Ocorreu um erro inesperado. Por favor, recarregue a página."}
        </p>
        {isFirebaseConfigError && (
            <div className="mt-6 bg-base-800 p-6 rounded-lg text-left max-w-3xl w-full">
                <p className="font-bold text-lg mb-2">Como resolver:</p>
                <ol className="list-decimal list-inside space-y-2 text-base-200">
                  <li>Acesse o <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand-primary-light underline hover:text-brand-primary">Console do Firebase</a> e selecione seu projeto.</li>
                  <li>Clique no ícone de engrenagem (⚙️) e vá para <strong className="text-base-100">Configurações do Projeto</strong>.</li>
                  <li>Na aba "Geral", role para baixo até a seção "Seus apps".</li>
                  <li>Selecione seu app da Web e na seção "SDK setup and configuration", escolha a opção <strong className="text-base-100">"Config"</strong>.</li>
                  <li><strong className="text-yellow-300">Copie o objeto de configuração inteiro</strong>, que começa com <code className="bg-base-700 px-1 rounded text-sm">const firebaseConfig = {'{'} ... {'}'}</code>.</li>
                  <li>Abra o arquivo <code className="bg-base-700 px-1 rounded text-sm">index.html</code> no seu editor de código.</li>
                  <li>Encontre o script que define <code className="bg-base-700 px-1 rounded text-sm">window.__FIREBASE_CONFIG__</code> e <strong className="text-yellow-300">substitua o objeto de exemplo INTEIRO</strong> pelo que você copiou do Firebase.</li>
                  <li>Salve o arquivo e <strong className="text-base-100">recarregue esta página</strong>.</li>
              </ol>
            </div>
        )}
      </div>
    );
  }

  if (!user) {
      return <LoginScreen onLogin={handleGoogleLogin} initialError={null} />;
  }

  return <App user={user} firebaseReady={firebaseConfigValid} />;
};



const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <RootComponent />
    </ErrorBoundary>
  </React.StrictMode>
);