// Cart management system with localStorage persistence
import type { CartItem, CartState, CartAction, MenuItem } from './api';

export class CartService {
  private static readonly STORAGE_KEY = 'letsorder_cart';
  private static readonly STORAGE_VERSION = '1.0';
  
  private state: CartState;
  private listeners: ((state: CartState) => void)[] = [];

  constructor(restaurantCode: string, tableCode: string) {
    this.state = this.loadFromStorage() || this.createInitialState(restaurantCode, tableCode);
    
    // Ensure we're on the right restaurant/table combination
    if (this.state.restaurantCode !== restaurantCode || this.state.tableCode !== tableCode) {
      this.state = this.createInitialState(restaurantCode, tableCode);
      this.saveToStorage();
    }
  }

  private createInitialState(restaurantCode: string, tableCode: string): CartState {
    return {
      items: [],
      restaurantCode,
      tableCode,
      totalItems: 0,
      totalPrice: 0,
      lastUpdated: Date.now()
    };
  }

  private loadFromStorage(): CartState | null {
    try {
      const stored = localStorage.getItem(CartService.STORAGE_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      
      // Version check and basic validation
      if (!parsed || typeof parsed !== 'object' || !parsed.items || !Array.isArray(parsed.items)) {
        return null;
      }

      return parsed as CartState;
    } catch (error) {
      console.error('Failed to load cart from storage:', error);
      return null;
    }
  }

  private saveToStorage(): void {
    try {
      const stateToStore = {
        ...this.state,
        version: CartService.STORAGE_VERSION,
        lastUpdated: Date.now()
      };
      localStorage.setItem(CartService.STORAGE_KEY, JSON.stringify(stateToStore));
    } catch (error) {
      console.error('Failed to save cart to storage:', error);
    }
  }

  private updateTotals(): void {
    this.state.totalItems = this.state.items.reduce((sum, item) => sum + item.quantity, 0);
    this.state.totalPrice = this.state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    this.state.lastUpdated = Date.now();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Cart listener error:', error);
      }
    });
  }

  private dispatch(action: CartAction): void {
    switch (action.type) {
      case 'ADD_ITEM':
        this.addItem(action.payload);
        break;
      case 'UPDATE_QUANTITY':
        this.updateQuantity(action.payload.id, action.payload.quantity);
        break;
      case 'REMOVE_ITEM':
        this.removeItem(action.payload.id);
        break;
      case 'UPDATE_SPECIAL_REQUESTS':
        this.updateSpecialRequests(action.payload.id, action.payload.specialRequests);
        break;
      case 'CLEAR_CART':
        this.clearCart();
        break;
      case 'LOAD_CART':
        const loaded = this.loadFromStorage();
        if (loaded) {
          this.state = loaded;
          this.updateTotals();
        }
        break;
    }
    
    this.saveToStorage();
    this.notifyListeners();
  }

  // Public methods
  public addItem(menuItem: MenuItem, quantity: number = 1, sectionName?: string): void {
    const existingItem = this.state.items.find(item => item.id === menuItem.id);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      const cartItem: CartItem = {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description,
        price: menuItem.price,
        quantity,
        sectionName,
        specialRequests: ''
      };
      this.state.items.push(cartItem);
    }
    
    this.updateTotals();
    this.saveToStorage();
    this.notifyListeners();
  }

  public updateQuantity(itemId: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(itemId);
      return;
    }

    const item = this.state.items.find(item => item.id === itemId);
    if (item) {
      item.quantity = quantity;
      this.updateTotals();
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public removeItem(itemId: number): void {
    this.state.items = this.state.items.filter(item => item.id !== itemId);
    this.updateTotals();
    this.saveToStorage();
    this.notifyListeners();
  }

  public updateSpecialRequests(itemId: number, specialRequests: string): void {
    const item = this.state.items.find(item => item.id === itemId);
    if (item) {
      item.specialRequests = specialRequests;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public clearCart(): void {
    this.state.items = [];
    this.updateTotals();
    this.saveToStorage();
    this.notifyListeners();
  }

  public getState(): CartState {
    return { ...this.state };
  }

  public getItem(itemId: number): CartItem | undefined {
    return this.state.items.find(item => item.id === itemId);
  }

  public getItemQuantity(itemId: number): number {
    const item = this.getItem(itemId);
    return item ? item.quantity : 0;
  }

  public isEmpty(): boolean {
    return this.state.items.length === 0;
  }

  public getTotalItems(): number {
    return this.state.totalItems;
  }

  public getTotalPrice(): number {
    return this.state.totalPrice;
  }

  public subscribe(listener: (state: CartState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Convert cart to order format
  public toOrderData(customerName?: string, customerPhone?: string) {
    return {
      table_code: this.state.tableCode,
      items: this.state.items.map(item => ({
        menu_item_id: item.id.toString(),
        quantity: item.quantity,
        special_requests: item.specialRequests || undefined
      })),
      customer_name: customerName
    };
  }

  // Validation methods
  public validateCart(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (this.state.items.length === 0) {
      errors.push('Cart is empty');
    }
    
    // Check for invalid quantities
    const invalidQuantities = this.state.items.filter(item => item.quantity <= 0);
    if (invalidQuantities.length > 0) {
      errors.push('Some items have invalid quantities');
    }
    
    // Check for missing required data
    if (!this.state.restaurantCode || !this.state.tableCode) {
      errors.push('Missing restaurant or table information');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Static methods for global cart management
  private static instance: CartService | null = null;
  
  public static getInstance(restaurantCode: string, tableCode: string): CartService {
    if (!CartService.instance || 
        CartService.instance.state.restaurantCode !== restaurantCode || 
        CartService.instance.state.tableCode !== tableCode) {
      CartService.instance = new CartService(restaurantCode, tableCode);
    }
    return CartService.instance;
  }
  
  public static clearInstance(): void {
    CartService.instance = null;
  }
}

// Global cart utility functions for use in components
export function getCartInstance(restaurantCode: string, tableCode: string): CartService {
  return CartService.getInstance(restaurantCode, tableCode);
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function getCartItemTotal(item: CartItem): number {
  return item.price * item.quantity;
}