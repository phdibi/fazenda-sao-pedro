import React, { Component, ReactNode } from 'react';
import { isFirestoreError, FirestoreErrorCode } from '../types';

// ============================================
// TIPOS
// ============================================

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCode?: FirestoreErrorCode;
  isOffline: boolean;
}

// ============================================
// MENSAGENS DE ERRO POR CÓDIGO
// ============================================

const ERROR_MESSAGES: Record<FirestoreErrorCode, { title: string; message: string; icon: string }> = {
  'permission-denied': {
    title: 'Acesso Negado',
    message: 'Você não tem permissão para acessar estes dados. Verifique se está logado corretamente.',
    icon: '🔒',
  },
  'unavailable': {
    title: 'Serviço Indisponível',
    message: 'O servidor está temporariamente indisponível. Seus dados locais foram preservados.',
    icon: '🔌',
  },
  'not-found': {
    title: 'Não Encontrado',
    message: 'Os dados solicitados não foram encontrados no servidor.',
    icon: '🔍',
  },
  'already-exists': {
    title: 'Já Existe',
    message: 'Este registro já existe no banco de dados.',
    icon: '📋',
  },
  'resource-exhausted': {
    title: 'Limite Excedido',
    message: 'Limite de operações atingido. Aguarde alguns minutos antes de tentar novamente.',
    icon: '⏳',
  },
  'cancelled': {
    title: 'Operação Cancelada',
    message: 'A operação foi cancelada. Tente novamente.',
    icon: '❌',
  },
  'unknown': {
    title: 'Erro Desconhecido',
    message: 'Ocorreu um erro inesperado. Tente novamente.',
    icon: '❓',
  },
};

// ============================================
// HELPERS
// ============================================

/**
 * Detecta se o erro é relacionado ao Firestore
 */
function isFirestoreRelatedError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  return (
    message.includes('firestore') ||
    message.includes('firebase') ||
    message.includes('permission') ||
    message.includes('network') ||
    message.includes('unavailable') ||
    name.includes('firebaseerror') ||
    isFirestoreError(error)
  );
}

/**
 * Extrai código de erro do Firestore
 */
function extractErrorCode(error: Error): FirestoreErrorCode {
  if (isFirestoreError(error)) {
    return error.code;
  }
  
  const message = error.message.toLowerCase();
  
  if (message.includes('permission')) return 'permission-denied';
  if (message.includes('unavailable') || message.includes('network')) return 'unavailable';
  if (message.includes('not found') || message.includes('not-found')) return 'not-found';
  if (message.includes('already exists')) return 'already-exists';
  if (message.includes('quota') || message.includes('exhausted')) return 'resource-exhausted';
  if (message.includes('cancelled') || message.includes('canceled')) return 'cancelled';
  
  return 'unknown';
}

// ============================================
// COMPONENTE DE FALLBACK OFFLINE
// ============================================

interface OfflineFallbackProps {
  onRetry?: () => void;
  errorInfo: { title: string; message: string; icon: string };
  showDetails?: boolean;
  errorStack?: string;
}

const OfflineFallback: React.FC<OfflineFallbackProps> = ({
  onRetry,
  errorInfo,
  showDetails = false,
  errorStack,
}) => (
  <div className="flex flex-col items-center justify-center p-6 bg-base-900 border border-base-700 rounded-xl">
    <div className="text-5xl mb-4">{errorInfo.icon}</div>
    
    <h3 className="text-xl font-bold text-white mb-2">{errorInfo.title}</h3>
    
    <p className="text-base-300 text-center mb-4 max-w-sm">
      {errorInfo.message}
    </p>
    
    <div className="flex gap-3">
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-light 
                     text-white font-medium rounded-lg transition-colors"
        >
          Tentar Novamente
        </button>
      )}
      
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-base-700 hover:bg-base-600 
                   text-white font-medium rounded-lg transition-colors"
      >
        Recarregar
      </button>
    </div>
    
    {showDetails && errorStack && (
      <details className="mt-4 w-full text-xs text-base-400">
        <summary className="cursor-pointer hover:text-base-200">
          Detalhes técnicos
        </summary>
        <pre className="mt-2 p-2 bg-base-800 rounded overflow-auto max-h-32">
          {errorStack}
        </pre>
      </details>
    )}
  </div>
);

// ============================================
// ERROR BOUNDARY PRINCIPAL
// ============================================

class FirestoreErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isOffline: !navigator.onLine,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    // Só captura erros relacionados ao Firestore
    if (!isFirestoreRelatedError(error)) {
      // Re-throw para o ErrorBoundary pai tratar
      throw error;
    }

    return {
      hasError: true,
      error,
      errorCode: extractErrorCode(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔥 [FirestoreErrorBoundary] Erro capturado:', {
      error,
      errorInfo,
      errorCode: this.state.errorCode,
      isOffline: this.state.isOffline,
    });
  }

  componentDidMount() {
    // Monitora status de conexão
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline = () => {
    this.setState({ isOffline: false });
    // Auto-retry quando voltar online
    if (this.state.hasError && this.props.onRetry) {
      this.handleRetry();
    }
  };

  handleOffline = () => {
    this.setState({ isOffline: true });
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorCode: undefined });
    this.props.onRetry?.();
  };

  render() {
    const { hasError, error, errorCode, isOffline } = this.state;
    const { children, fallback, onRetry } = this.props;

    // Mostra indicador de offline mesmo sem erro
    if (isOffline && !hasError) {
      return (
        <>
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600 text-white text-center py-1 text-sm">
            📡 Você está offline. Alterações serão sincronizadas quando a conexão voltar.
          </div>
          {children}
        </>
      );
    }

    if (hasError) {
      // Usa fallback customizado se fornecido
      if (fallback) {
        return fallback;
      }

      const errorInfo = ERROR_MESSAGES[errorCode || 'unknown'];

      return (
        <div className="p-4">
          <OfflineFallback
            onRetry={onRetry ? this.handleRetry : undefined}
            errorInfo={errorInfo}
            showDetails={process.env.NODE_ENV === 'development'}
            errorStack={error?.stack}
          />
        </div>
      );
    }

    return children;
  }
}

export default FirestoreErrorBoundary;
