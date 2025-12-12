// ============================================
// 🔧 LOGGER - SUBSTITUI CONSOLE.LOG EM PRODUÇÃO
// ============================================
// Em desenvolvimento: mostra tudo
// Em produção: só mostra erros e warnings

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'perf';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  showTimestamp: boolean;
  showPrefix: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  perf: 2,
  warn: 3,
  error: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#9CA3AF', // gray
  info: '#60A5FA',  // blue
  perf: '#A78BFA',  // purple
  warn: '#FBBF24',  // yellow
  error: '#EF4444', // red
};

const LOG_PREFIXES: Record<LogLevel, string> = {
  debug: '🐛',
  info: 'ℹ️',
  perf: '⚡',
  warn: '⚠️',
  error: '❌',
};

class Logger {
  private config: LoggerConfig;

  constructor() {
    const isDev = import.meta.env.DEV;
    
    this.config = {
      enabled: true,
      minLevel: isDev ? 'debug' : 'warn',
      showTimestamp: isDev,
      showPrefix: true,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string): string[] {
    const parts: string[] = [];
    
    if (this.config.showTimestamp) {
      const now = new Date();
      const time = now.toLocaleTimeString('pt-BR', { hour12: false });
      parts.push(`[${time}]`);
    }
    
    if (this.config.showPrefix) {
      parts.push(LOG_PREFIXES[level]);
    }
    
    parts.push(message);
    
    return parts;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const formattedParts = this.formatMessage(level, message);
    const fullMessage = formattedParts.join(' ');
    const color = LOG_COLORS[level];

    switch (level) {
      case 'error':
        console.error(`%c${fullMessage}`, `color: ${color}`, ...args);
        break;
      case 'warn':
        console.warn(`%c${fullMessage}`, `color: ${color}`, ...args);
        break;
      default:
        console.log(`%c${fullMessage}`, `color: ${color}`, ...args);
    }
  }

  // ============================================
  // MÉTODOS PÚBLICOS
  // ============================================

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Log de performance - útil para medir tempos
   */
  perf(label: string, startTime?: number): void {
    if (startTime) {
      const duration = performance.now() - startTime;
      this.log('perf', `${label}: ${duration.toFixed(2)}ms`);
    } else {
      this.log('perf', label);
    }
  }

  /**
   * Inicia medição de tempo
   */
  time(label: string): number {
    if (this.shouldLog('perf')) {
      this.log('perf', `⏱️ Iniciando: ${label}`);
    }
    return performance.now();
  }

  /**
   * Finaliza medição de tempo
   */
  timeEnd(label: string, startTime: number): void {
    const duration = performance.now() - startTime;
    this.log('perf', `⏱️ ${label}: ${duration.toFixed(2)}ms`);
  }

  /**
   * Log agrupado
   */
  group(label: string, collapsed = true): void {
    if (!this.shouldLog('debug')) return;
    
    if (collapsed) {
      console.groupCollapsed(`%c${LOG_PREFIXES.debug} ${label}`, `color: ${LOG_COLORS.debug}`);
    } else {
      console.group(`%c${LOG_PREFIXES.debug} ${label}`, `color: ${LOG_COLORS.debug}`);
    }
  }

  groupEnd(): void {
    if (!this.shouldLog('debug')) return;
    console.groupEnd();
  }

  /**
   * Log de tabela (útil para arrays/objetos)
   */
  table(data: any, columns?: string[]): void {
    if (!this.shouldLog('debug')) return;
    console.table(data, columns);
  }

  // ============================================
  // CONFIGURAÇÃO
  // ============================================

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  /**
   * Modo silencioso - só erros
   */
  silent(): void {
    this.config.minLevel = 'error';
  }

  /**
   * Modo verbose - tudo
   */
  verbose(): void {
    this.config.minLevel = 'debug';
  }
}

// Exporta instância singleton
export const logger = new Logger();

// Também exporta a classe para testes
export { Logger };

// Atalhos convenientes
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  perf: logger.perf.bind(logger),
  time: logger.time.bind(logger),
  timeEnd: logger.timeEnd.bind(logger),
  group: logger.group.bind(logger),
  groupEnd: logger.groupEnd.bind(logger),
  table: logger.table.bind(logger),
};
