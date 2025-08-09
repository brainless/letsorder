// API utility module for menu app
import type { 
  MenuData, 
  OrderData, 
  CreateOrderResult,
  OrderDetails
} from '../types/menu';

const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL || "http://localhost:8080";
const API_VERSION = import.meta.env.PUBLIC_API_VERSION || "";

const API_URL = API_VERSION ? `${API_BASE_URL}/${API_VERSION}` : API_BASE_URL;

// Error logging function
function logError(context: string, error: unknown, metadata?: Record<string, any>) {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : String(error),
    url: typeof window !== 'undefined' ? window.location.href : 'server-side',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server-side',
    ...metadata
  };
  
  console.error(`[API Error] ${context}:`, errorInfo);
  
  // Store error in localStorage for potential debugging
  if (typeof window !== 'undefined') {
    try {
      const errors = JSON.parse(localStorage.getItem('menuapp_errors') || '[]');
      errors.push(errorInfo);
      // Keep only last 10 errors
      const recentErrors = errors.slice(-10);
      localStorage.setItem('menuapp_errors', JSON.stringify(recentErrors));
    } catch (e) {
      // Ignore localStorage errors
    }
  }
}

// Retry mechanism with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  context = 'API operation'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        logError(`${context} - Final attempt failed`, lastError, { 
          attempt, 
          maxRetries 
        });
        throw lastError;
      }
      
      // Check if error should be retried
      const shouldRetry = shouldRetryError(lastError);
      if (!shouldRetry) {
        logError(`${context} - Non-retryable error`, lastError, { 
          attempt 
        });
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logError(`${context} - Retrying`, lastError, { 
        attempt, 
        nextRetryIn: delay,
        maxRetries 
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Determine if an error should be retried
function shouldRetryError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors that should be retried
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('connection')
  ) {
    return true;
  }
  
  // HTTP 5xx errors should be retried
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }
  
  // HTTP 4xx errors (except 408 timeout) should not be retried
  if (message.includes('400') || message.includes('401') || message.includes('403') || message.includes('404')) {
    return false;
  }
  
  // Default to retry for unknown errors
  return true;
}

/**
 * Fetch menu data for a specific restaurant and table
 */
export async function fetchMenu(
  restaurantCode: string,
  tableCode: string,
): Promise<MenuData> {
  return retryWithBackoff(
    async () => {
      const apiUrl = `${API_URL}/menu/${restaurantCode}/${tableCode}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 seconds
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Restaurant or table not found: ${response.status}`);
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        } else {
          throw new Error(`Failed to fetch menu: ${response.status}`);
        }
      }
      
      const data = await response.json();
      return data;
    },
    3, // maxRetries
    1000, // baseDelay
    `fetchMenu(${restaurantCode}, ${tableCode})`
  );
}

/**
 * Create a new order
 */
export async function createOrder(
  orderData: OrderData,
): Promise<CreateOrderResult> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(orderData),
        // Add timeout
        signal: AbortSignal.timeout(15000) // 15 seconds for order creation
      });

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        } else if (response.status === 400) {
          // Bad request - don't retry
          const errorText = await response.text();
          throw new Error(`Invalid order data: ${errorText}`);
        } else {
          throw new Error(`Failed to create order: ${response.status}`);
        }
      }

      return await response.json();
    },
    2, // maxRetries (fewer for order creation to avoid duplicates)
    1500, // baseDelay
    `createOrder`
  );
}

/**
 * Get order details by order ID
 */
export async function getOrder(orderId: string): Promise<OrderDetails> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(`${API_URL}/orders/${orderId}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 seconds
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Order not found');
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        } else {
          throw new Error(`Failed to fetch order: ${response.status}`);
        }
      }
      
      const data = await response.json();
      return data as OrderDetails;
    },
    3, // maxRetries
    1000, // baseDelay
    `getOrder(${orderId})`
  );
}

// Export error logging function for use in components
export { logError };
