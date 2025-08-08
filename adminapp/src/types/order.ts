import { OrderResponse, OrderItemResponse } from './api';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

// Use generated types with proper status typing
export type OrderItem = OrderItemResponse;
export interface Order extends Omit<OrderResponse, 'status'> {
  status: OrderStatus;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface OrderFilters {
  status?: OrderStatus;
  table_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface OrderStats {
  total_orders: number;
  total_revenue: number;
  pending_orders: number;
  completed_orders: number;
  average_order_value: number;
}

export interface OrderContextType {
  orders: Order[];
  stats: OrderStats | null;
  isLoading: boolean;
  error: string | null;
  filters: OrderFilters;
  setFilters: (filters: OrderFilters) => void;
  loadOrders: (restaurantId: string) => Promise<void>;
  loadTodayOrders: (restaurantId: string) => Promise<void>;
  loadTableOrders: (restaurantId: string, tableId: string) => Promise<void>;
  getOrder: (orderId: string) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  refreshOrders: () => Promise<void>;
  clearError: () => void;
}

// These types are now imported from api.ts and used above
