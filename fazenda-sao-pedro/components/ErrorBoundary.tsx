import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 Erro capturado pelo Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
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
              {this.state.error?.message || 'Erro desconhecido'}
            </p>

            <details className="mb-4 text-xs text-base-400">
              <summary className="cursor-pointer hover:text-base-200">
                Ver detalhes técnicos
              </summary>
              <pre className="mt-2 p-2 bg-base-800 rounded overflow-auto">
                {this.state.error?.stack}
              </pre>
            </details>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-brand-primary hover:bg-brand-primary-light 
                         text-white font-semibold py-3 px-4 rounded-lg 
                         transition-colors"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
