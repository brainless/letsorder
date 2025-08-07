// API utility module for menu app

const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL || "http://localhost:8080";
const API_VERSION = import.meta.env.PUBLIC_API_VERSION || "";

const API_URL = API_VERSION ? `${API_BASE_URL}/${API_VERSION}` : API_BASE_URL;

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface MenuSection {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface MenuData {
  restaurant: {
    name: string;
    code: string;
    address?: string;
  };
  table: {
    code: string;
    name: string;
  };
  sections: MenuSection[];
}

export interface OrderItem {
  menu_item_id: string;
  quantity: number;
  special_requests?: string;
}

export interface OrderData {
  table_code: string;
  items: OrderItem[];
  customer_name?: string;
}

// Cart-specific interfaces
export interface CartItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  specialRequests?: string;
  sectionName?: string;
}

export interface CartState {
  items: CartItem[];
  restaurantCode: string;
  tableCode: string;
  totalItems: number;
  totalPrice: number;
  lastUpdated: number;
}

export interface CartAction {
  type:
    | "ADD_ITEM"
    | "UPDATE_QUANTITY"
    | "REMOVE_ITEM"
    | "UPDATE_SPECIAL_REQUESTS"
    | "CLEAR_CART"
    | "LOAD_CART";
  payload?: any;
}

/**
 * Fetch menu data for a specific restaurant and table
 */
export async function fetchMenu(
  restaurantCode: string,
  tableCode: string,
): Promise<MenuData> {
  const apiUrl = `${API_URL}/menu/${restaurantCode}/${tableCode}`;
  console.log('[API DEBUG] API_BASE_URL:', API_BASE_URL);
  console.log('[API DEBUG] API_VERSION:', API_VERSION);
  console.log('[API DEBUG] API_URL:', API_URL);
  console.log('[API DEBUG] Full fetch URL:', apiUrl);
  
  try {
    console.log('[API DEBUG] Making fetch request to:', apiUrl);
    const response = await fetch(apiUrl);
    console.log('[API DEBUG] Response status:', response.status);
    console.log('[API DEBUG] Response ok:', response.ok);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch menu: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[API DEBUG] Response data:', data);
    return data;
  } catch (error) {
    console.error('[API DEBUG] Error fetching menu:', error);
    throw error;
  }
}

/**
 * Create a new order
 */
export async function createOrder(
  orderData: OrderData,
): Promise<{ order_id: string }> {
  try {
    // Debug: first send to debug endpoint
    console.log('Debug: sending order data:', JSON.stringify(orderData, null, 2));
    await fetch(`${API_URL}/debug/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });
    
    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create order: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating order:", error);
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
    console.error("Error fetching order:", error);
    throw error;
  }
}
