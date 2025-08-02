import { createContext, createSignal, useContext, ParentComponent, createEffect } from 'solid-js';
import { OrderService } from '../services/order';
import type { Order, OrderStats, OrderFilters, OrderStatus, OrderContextType } from '../types/order';

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: ParentComponent = (props) => {
  const [orders, setOrders] = createSignal<Order[]>([]);
  const [stats, setStats] = createSignal<OrderStats | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [filters, setFilters] = createSignal<OrderFilters>({});
  const [currentRestaurantId, setCurrentRestaurantId] = createSignal<string | null>(null);

  // Auto-refresh interval for real-time updates
  const [refreshInterval, setRefreshInterval] = createSignal<number | null>(null);

  const handleError = (err: unknown) => {
    console.error('Order operation error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    setError(message);
  };

  const clearError = () => {
    setError(null);
  };

  const loadOrders = async (restaurantId: string) => {
    setIsLoading(true);
    setError(null);
    setCurrentRestaurantId(restaurantId);

    try {
      const fetchedOrders = await OrderService.getRestaurantOrders(restaurantId);
      setOrders(fetchedOrders);
      
      // Calculate stats
      const orderStats = OrderService.calculateOrderStats(fetchedOrders);
      setStats(orderStats);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTodayOrders = async (restaurantId: string) => {
    setIsLoading(true);
    setError(null);
    setCurrentRestaurantId(restaurantId);

    try {
      const fetchedOrders = await OrderService.getTodayOrders(restaurantId);
      setOrders(fetchedOrders);
      
      // Calculate stats
      const orderStats = OrderService.calculateOrderStats(fetchedOrders);
      setStats(orderStats);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTableOrders = async (restaurantId: string, tableId: string) => {
    setIsLoading(true);
    setError(null);
    setCurrentRestaurantId(restaurantId);

    try {
      const fetchedOrders = await OrderService.getTableOrders(restaurantId, tableId);
      setOrders(fetchedOrders);
      
      // Calculate stats
      const orderStats = OrderService.calculateOrderStats(fetchedOrders);
      setStats(orderStats);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getOrder = async (orderId: string): Promise<Order | null> => {
    setError(null);

    try {
      return await OrderService.getOrder(orderId);
    } catch (err) {
      handleError(err);
      return null;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setError(null);

    try {
      await OrderService.updateOrderStatus(orderId, status);
      
      // Update local order status
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status }
          : order
      ));

      // Recalculate stats
      const updatedOrders = orders();
      const orderStats = OrderService.calculateOrderStats(updatedOrders);
      setStats(orderStats);
    } catch (err) {
      handleError(err);
      throw err; // Re-throw so UI can handle the error
    }
  };

  const refreshOrders = async () => {
    const restaurantId = currentRestaurantId();
    if (restaurantId) {
      // Use the same load method that was last used
      await loadOrders(restaurantId);
    }
  };

  // Auto-refresh setup
  const startAutoRefresh = (intervalMs: number = 30000) => {
    stopAutoRefresh();
    const id = setInterval(refreshOrders, intervalMs);
    setRefreshInterval(id);
  };

  const stopAutoRefresh = () => {
    const id = refreshInterval();
    if (id !== null) {
      clearInterval(id);
      setRefreshInterval(null);
    }
  };

  // Cleanup interval on unmount
  createEffect(() => {
    return () => stopAutoRefresh();
  });

  // Filtered and sorted orders
  const getFilteredOrders = () => {
    const currentFilters = filters();
    let filteredOrders = OrderService.filterOrders(orders(), currentFilters);
    
    // Default sort by created_at desc (newest first)
    filteredOrders = OrderService.sortOrders(filteredOrders, 'created_at', 'desc');
    
    return filteredOrders;
  };

  const contextValue: OrderContextType = {
    get orders() { return getFilteredOrders(); },
    get stats() { return stats(); },
    get isLoading() { return isLoading(); },
    get error() { return error(); },
    get filters() { return filters(); },
    setFilters,
    loadOrders,
    loadTodayOrders,
    loadTableOrders,
    getOrder,
    updateOrderStatus,
    refreshOrders,
    clearError,
  };

  // Additional utility methods for the provider
  const providerValue = {
    ...contextValue,
    startAutoRefresh,
    stopAutoRefresh,
    getRawOrders: orders,
  };

  return (
    <OrderContext.Provider value={contextValue}>
      {props.children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

// Hook for order management with auto-refresh
export const useOrderManagement = (restaurantId: string, autoRefresh = true) => {
  const orders = useOrders();
  
  createEffect(() => {
    if (restaurantId) {
      orders.loadOrders(restaurantId);
      
      if (autoRefresh) {
        // Start auto-refresh every 30 seconds
        const interval = setInterval(() => {
          orders.refreshOrders();
        }, 30000);
        
        return () => clearInterval(interval);
      }
    }
  });
  
  return orders;
};