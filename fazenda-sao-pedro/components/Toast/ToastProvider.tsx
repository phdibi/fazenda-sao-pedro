import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// ============================================
// TIPOS
// ============================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  // Atalhos convenientes
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
}

// ============================================
// CONTEXT
// ============================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================
// HOOK
// ============================================

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// ============================================
// PROVIDER
// ============================================

const DEFAULT_DURATION = 4000;
const MAX_TOASTS = 5;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++toastIdRef.current}`;
    const duration = toast.duration ?? DEFAULT_DURATION;

    setToasts((prev) => {
      // Limita número máximo de toasts
      const newToasts = [...prev, { ...toast, id }];
      if (newToasts.length > MAX_TOASTS) {
        return newToasts.slice(-MAX_TOASTS);
      }
      return newToasts;
    });

    // Auto-remove após duração
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  // Atalhos convenientes
  const success = useCallback(
    (message: string, duration?: number) => addToast({ type: 'success', message, duration }),
    [addToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => addToast({ type: 'error', message, duration: duration ?? 6000 }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => addToast({ type: 'warning', message, duration }),
    [addToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => addToast({ type: 'info', message, duration }),
    [addToast]
  );

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// ============================================
// TOAST CONTAINER (renderiza os toasts)
// ============================================

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

// ============================================
// TOAST ITEM (toast individual)
// ============================================

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  }, [onRemove, toast.id]);

  // Cores por tipo
  const typeStyles: Record<ToastType, string> = {
    success: 'bg-green-900/95 border-green-500 text-green-100',
    error: 'bg-red-900/95 border-red-500 text-red-100',
    warning: 'bg-yellow-900/95 border-yellow-500 text-yellow-100',
    info: 'bg-blue-900/95 border-blue-500 text-blue-100',
  };

  // Ícones por tipo
  const icons: Record<ToastType, React.ReactNode> = {
    success: (
      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className={`
        pointer-events-auto
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transform transition-all duration-200 ease-out
        ${typeStyles[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.message}</p>
        
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleClose();
            }}
            className="mt-2 text-xs font-semibold underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Fechar"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default ToastProvider;
