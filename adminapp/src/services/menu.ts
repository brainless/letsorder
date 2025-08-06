import { config } from '../config/env';
import { TokenStorage } from './auth';
import type {
  MenuSection,
  MenuItem,
  CreateMenuSectionRequest,
  UpdateMenuSectionRequest,
  CreateMenuItemRequest,
  UpdateMenuItemRequest,
  ReorderSectionsRequest,
  ReorderItemsRequest,
  ToggleAvailabilityRequest,
  MenuSectionWithItems,
  RestaurantMenu,
} from '../types/menu';

export class MenuService {
  private static readonly BASE_URL = `${config.apiUrl}/api`;

  private static getHeaders(): HeadersInit {
    const token = TokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorBody = await response.json();
        if (errorBody.message) {
          errorMessage = errorBody.message;
        } else if (errorBody.error) {
          errorMessage = errorBody.error;
        }
      } catch {
        // If we can't parse JSON, stick with the basic error message
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Get restaurant menu with sections and items
  static async getRestaurantMenu(
    restaurantId: string
  ): Promise<RestaurantMenu> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/menu`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<RestaurantMenu>(response);
  }

  // Menu Sections
  static async createSection(
    restaurantId: string,
    data: CreateMenuSectionRequest
  ): Promise<MenuSection> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/menu/sections`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }
    );

    return this.handleResponse<MenuSection>(response);
  }

  static async updateSection(
    sectionId: string,
    data: UpdateMenuSectionRequest
  ): Promise<MenuSection> {
    const response = await fetch(`${this.BASE_URL}/sections/${sectionId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<MenuSection>(response);
  }

  static async deleteSection(sectionId: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/sections/${sectionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<void>(response);
  }

  static async reorderSections(data: ReorderSectionsRequest): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/sections/reorder`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<void>(response);
  }

  // Menu Items
  static async createItem(
    sectionId: string,
    data: CreateMenuItemRequest
  ): Promise<MenuItem> {
    const response = await fetch(
      `${this.BASE_URL}/sections/${sectionId}/items`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }
    );

    return this.handleResponse<MenuItem>(response);
  }

  static async updateItem(
    itemId: string,
    data: UpdateMenuItemRequest
  ): Promise<MenuItem> {
    const response = await fetch(`${this.BASE_URL}/items/${itemId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<MenuItem>(response);
  }

  static async deleteItem(itemId: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/items/${itemId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<void>(response);
  }

  static async toggleItemAvailability(
    itemId: string,
    data: ToggleAvailabilityRequest
  ): Promise<MenuItem> {
    const response = await fetch(
      `${this.BASE_URL}/items/${itemId}/availability`,
      {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }
    );

    return this.handleResponse<MenuItem>(response);
  }

  static async reorderItems(data: ReorderItemsRequest): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/items/reorder`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<void>(response);
  }

  // Bulk operations
  static async bulkDeleteItems(itemIds: string[]): Promise<void> {
    const promises = itemIds.map((id) => this.deleteItem(id));
    await Promise.all(promises);
  }

  static async bulkToggleAvailability(
    itemIds: string[],
    available: boolean
  ): Promise<void> {
    const promises = itemIds.map((id) =>
      this.toggleItemAvailability(id, { available })
    );
    await Promise.all(promises);
  }

  static async bulkDeleteSections(sectionIds: string[]): Promise<void> {
    const promises = sectionIds.map((id) => this.deleteSection(id));
    await Promise.all(promises);
  }
}
