import { 
  PublicMenu, 
  PublicMenuSection, 
  PublicMenuItem, 
  OrderItem as GeneratedOrderItem,
  CreateOrderResponse 
} from './api';

// Use generated types for API contracts
export type MenuItem = PublicMenuItem;
export type MenuSection = PublicMenuSection;
export type MenuData = PublicMenu;

// Order types - use generated types
export type OrderItem = GeneratedOrderItem;

// Custom order data type for API submission
export interface OrderData {
  table_code: string;
  items: OrderItem[];
  customer_name?: string;
}

// Cart-specific types (client-side extensions)
export interface CartItem extends MenuItem {
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

// API response types
export type CreateOrderResult = CreateOrderResponse;