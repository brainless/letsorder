export interface OrderItem {
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  price: number;
  special_requests?: string;
}

export interface Order {
  id: string;
  table_id: string;
  table_name: string;
  restaurant_name: string;
  items: OrderItem[];
  total_amount: number;
  status: OrderStatus;
  customer_name?: string;
  created_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

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

// API Response types matching backend
export interface OrderResponse {
  id: string;
  table_id: string;
  table_name: string;
  restaurant_name: string;
  items: OrderItemResponse[];
  total_amount: number;
  status: string;
  customer_name?: string;
  created_at: string;
}

export interface OrderItemResponse {
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  price: number;
  special_requests?: string;
}
