import React, { Component, ReactNode, ErrorInfo } from 'react';

// ============================================
// TIPOS
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback customizado */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Callback quando erro é capturado */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Nome do componente para logging */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================
// ERROR BOUNDARY MELHORADO
// ============================================

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, componentName } = this.props;
    
    // Log do erro
    const prefix = componentName ? `[${componentName}]` : '';
    console.error(`🔴 ${prefix} Erro capturado pelo Error Boundary:`, error);
    
    // Só mostra stack em desenvolvimento
    if (import.meta.env.DEV) {
      console.error('Stack trace:', errorInfo.componentStack);
    }

    this.setState({ errorInfo });

    // Callback opcional
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Fallback customizado como função
      if (typeof fallback === 'function') {
        return fallback(error, this.handleReset);
      }

      // Fallback customizado como elemento
      if (fallback) {
        return fallback;
      }

      // Fallback padrão
      return (
        <div className="min-h-screen bg-base-950 flex items-center justify-center p-4">
          <div className="bg-base-900 border border-base-700 rounded-xl p-8 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">😕</div>
              <h2 className="text-2xl font-bold text-red-400">
                Algo deu errado
              </h2>
            </div>

            <p className="text-base-200 mb-2">
              {error.message || 'Erro desconhecido'}
            </p>

            {import.meta.env.DEV && (
              <details className="mb-4 text-xs text-base-400">
                <summary className="cursor-pointer hover:text-base-200">
                  Ver detalhes técnicos
                </summary>
                <pre className="mt-2 p-2 bg-base-800 rounded overflow-auto max-h-48">
                  {error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-brand-primary hover:bg-brand-primary-light 
                           text-white font-semibold py-3 px-4 rounded-lg 
                           transition-colors"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-base-700 hover:bg-base-600 
                           text-white font-semibold py-3 px-4 rounded-lg 
                           transition-colors"
              >
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// ============================================
// HOC PARA ENVOLVER COMPONENTES
// ============================================

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary componentName={displayName} {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

export default ErrorBoundary;
