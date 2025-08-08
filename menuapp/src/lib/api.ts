// API utility module for menu app
import type { 
  MenuData, 
  OrderData, 
  CreateOrderResult 
} from '../types/menu';

const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL || "http://localhost:8080";
const API_VERSION = import.meta.env.PUBLIC_API_VERSION || "";

const API_URL = API_VERSION ? `${API_BASE_URL}/${API_VERSION}` : API_BASE_URL;

/**
 * Fetch menu data for a specific restaurant and table
 */
export async function fetchMenu(
  restaurantCode: string,
  tableCode: string,
): Promise<MenuData> {
  const apiUrl = `${API_URL}/menu/${restaurantCode}/${tableCode}`;
  
  try {
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch menu: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching menu:', error);
    throw error;
  }
}

/**
 * Create a new order
 */
export async function createOrder(
  orderData: OrderData,
): Promise<CreateOrderResult> {
  try {
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
