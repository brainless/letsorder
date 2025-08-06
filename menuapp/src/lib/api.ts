// API utility module for menu app

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8080';
const API_VERSION = import.meta.env.PUBLIC_API_VERSION || 'v1';

const API_URL = `${API_BASE_URL}/${API_VERSION}`;

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
}

export interface MenuSection {
  id: number;
  name: string;
  items: MenuItem[];
}

export interface MenuData {
  restaurant: {
    name: string;
    code: string;
  };
  table: {
    code: string;
    name: string;
  };
  sections: MenuSection[];
}

export interface OrderItem {
  menu_item_id: number;
  quantity: number;
}

export interface OrderData {
  restaurant_code: string;
  table_code: string;
  items: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
}

/**
 * Fetch menu data for a specific restaurant and table
 */
export async function fetchMenu(restaurantCode: string, tableCode: string): Promise<MenuData> {
  try {
    const response = await fetch(`${API_URL}/menu/${restaurantCode}/${tableCode}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch menu: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching menu:', error);
    throw error;
  }
}

/**
 * Create a new order
 */
export async function createOrder(orderData: OrderData): Promise<{ order_id: string }> {
  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create order: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

/**
 * Get order details by order ID
 */
export async function getOrder(orderId: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/orders/${orderId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch order: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
}
