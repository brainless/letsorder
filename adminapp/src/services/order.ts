import { config } from '../config/env';
import type {
  Order,
  OrderResponse,
  OrderStats,
  OrderStatus,
  UpdateOrderStatusRequest,
} from '../types/order';
import type { OrderItemResponse } from '../types/api';

const API_BASE = config.apiUrl;

export class OrderService {
  private static getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('letsorder_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  private static transformOrder(orderResponse: OrderResponse): Order {
    return {
      id: orderResponse.id,
      table_id: orderResponse.table_id,
      table_name: orderResponse.table_name,
      restaurant_name: orderResponse.restaurant_name,
      items: orderResponse.items.map((item: OrderItemResponse) => ({
        menu_item_id: item.menu_item_id,
        menu_item_name: item.menu_item_name,
        quantity: item.quantity,
        price: item.price,
        special_requests: item.special_requests,
      })),
      total_amount: orderResponse.total_amount,
      status: orderResponse.status as OrderStatus,
      customer_name: orderResponse.customer_name,
      created_at: orderResponse.created_at,
    };
  }

  static async getRestaurantOrders(restaurantId: string): Promise<Order[]> {
    const response = await fetch(
      `${API_BASE}/api/restaurants/${restaurantId}/orders`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      }
    );

    const orderResponses = await this.handleResponse<OrderResponse[]>(response);
    return orderResponses.map(this.transformOrder);
  }

  static async getTodayOrders(restaurantId: string): Promise<Order[]> {
    const response = await fetch(
      `${API_BASE}/api/restaurants/${restaurantId}/orders/today`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      }
    );

    const orderResponses = await this.handleResponse<OrderResponse[]>(response);
    return orderResponses.map(this.transformOrder);
  }

  static async getTableOrders(
    restaurantId: string,
    tableId: string
  ): Promise<Order[]> {
    const response = await fetch(
      `${API_BASE}/api/restaurants/${restaurantId}/tables/${tableId}/orders`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      }
    );

    const orderResponses = await this.handleResponse<OrderResponse[]>(response);
    return orderResponses.map(this.transformOrder);
  }

  static async getOrder(orderId: string): Promise<Order> {
    const response = await fetch(`${API_BASE}/orders/${orderId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const orderResponse = await this.handleResponse<OrderResponse>(response);
    return this.transformOrder(orderResponse);
  }

  static async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<void> {
    // Note: This endpoint doesn't exist yet in the backend
    // For now, we'll throw an error indicating this feature is not implemented
    const response = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status } as UpdateOrderStatusRequest),
    });

    await this.handleResponse<void>(response);
  }

  static calculateOrderStats(orders: Order[]): OrderStats {
    const stats: OrderStats = {
      total_orders: orders.length,
      total_revenue: 0,
      pending_orders: 0,
      completed_orders: 0,
      average_order_value: 0,
    };

    for (const order of orders) {
      stats.total_revenue += order.total_amount;

      switch (order.status) {
        case 'pending':
        case 'confirmed':
        case 'preparing':
        case 'ready':
          stats.pending_orders++;
          break;
        case 'delivered':
          stats.completed_orders++;
          break;
      }
    }

    stats.average_order_value =
      stats.total_orders > 0 ? stats.total_revenue / stats.total_orders : 0;

    return stats;
  }

  static filterOrders(
    orders: Order[],
    filters: {
      status?: OrderStatus;
      table_id?: string;
      search?: string;
      date_from?: string;
      date_to?: string;
    }
  ): Order[] {
    return orders.filter((order) => {
      // Status filter
      if (filters.status && order.status !== filters.status) {
        return false;
      }

      // Table filter
      if (filters.table_id && order.table_id !== filters.table_id) {
        return false;
      }

      // Search filter (customer name, table name, order ID)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          order.id.toLowerCase().includes(searchLower) ||
          order.table_name.toLowerCase().includes(searchLower) ||
          (order.customer_name &&
            order.customer_name.toLowerCase().includes(searchLower)) ||
          order.items.some((item) =>
            item.menu_item_name.toLowerCase().includes(searchLower)
          );

        if (!matchesSearch) {
          return false;
        }
      }

      // Date range filter
      if (filters.date_from || filters.date_to) {
        const orderDate = new Date(order.created_at);

        if (filters.date_from) {
          const fromDate = new Date(filters.date_from);
          if (orderDate < fromDate) {
            return false;
          }
        }

        if (filters.date_to) {
          const toDate = new Date(filters.date_to);
          toDate.setHours(23, 59, 59, 999); // End of day
          if (orderDate > toDate) {
            return false;
          }
        }
      }

      return true;
    });
  }

  static sortOrders(
    orders: Order[],
    sortBy: 'created_at' | 'total_amount' | 'status' = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Order[] {
    return [...orders].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'created_at':
          comparison =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'total_amount':
          comparison = a.total_amount - b.total_amount;
          break;
        case 'status':
          // Define status order for sorting
          const statusOrder = [
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'delivered',
            'cancelled',
          ];
          comparison =
            statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }
}
