// Client-side error logging and monitoring
interface ErrorInfo {
  timestamp: string;
  type: 'javascript' | 'unhandled_promise' | 'network' | 'user';
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  metadata?: Record<string, any>;
}

class ErrorLogger {
  private errors: ErrorInfo[] = [];
  private maxErrors = 20;
  private storageKey = 'menuapp_client_errors';

  constructor() {
    this.initializeErrorHandlers();
    this.loadStoredErrors();
  }

  private initializeErrorHandlers() {
    // Global error handler for JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'javascript',
        message: event.message,
        stack: event.error?.stack,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'unhandled_promise',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        metadata: {
          promise: event.promise
        }
      });
    });
  }

  public logError(params: {
    type: ErrorInfo['type'];
    message: string;
    stack?: string;
    metadata?: Record<string, any>;
  }) {
    const errorInfo: ErrorInfo = {
      timestamp: new Date().toISOString(),
      type: params.type,
      message: params.message,
      stack: params.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      metadata: params.metadata
    };

    this.errors.push(errorInfo);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    this.saveToStorage();
    this.sendErrorReport(errorInfo);

    console.error('[ErrorLogger]', errorInfo);
  }

  private loadStoredErrors() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.errors = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load stored errors:', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.errors));
    } catch (e) {
      console.warn('Failed to save errors to storage:', e);
    }
  }

  private sendErrorReport(errorInfo: ErrorInfo) {
    // In a real application, you might send errors to a logging service
    // For now, we'll just log them locally
    
    // Example of how you might send to a logging service:
    /*
    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorInfo)
    }).catch(() => {
      // Silently fail if error reporting fails
    });
    */
  }

  public getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  public clearErrors() {
    this.errors = [];
    this.saveToStorage();
  }

  public getErrorSummary() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentErrors = this.errors.filter(
      error => new Date(error.timestamp) >= last24Hours
    );

    const errorTypes = recentErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: this.errors.length,
      recentErrors: recentErrors.length,
      errorTypes,
      lastError: this.errors[this.errors.length - 1]
    };
  }
}

// Initialize error logger
const errorLogger = new ErrorLogger();

// Export for use in other modules
export { errorLogger };

// Make available globally for debugging
(window as any).errorLogger = errorLogger;

// Log network errors from fetch requests
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  try {
    const response = await originalFetch(...args);
    
    if (!response.ok) {
      errorLogger.logError({
        type: 'network',
        message: `HTTP ${response.status}: ${response.statusText}`,
        metadata: {
          url: args[0],
          status: response.status,
          statusText: response.statusText
        }
      });
    }
    
    return response;
  } catch (error) {
    errorLogger.logError({
      type: 'network',
      message: `Network error: ${error instanceof Error ? error.message : String(error)}`,
      stack: error instanceof Error ? error.stack : undefined,
      metadata: {
        url: args[0]
      }
    });
    
    throw error;
  }
};

console.log('[ErrorLogger] Client-side error logging initialized');