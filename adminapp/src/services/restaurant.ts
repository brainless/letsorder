import { CONFIG } from '../config/env';
import { TokenStorage } from './auth';
import type {
  Restaurant,
  CreateRestaurantRequest,
  UpdateRestaurantRequest,
  ManagerInfo,
  RestaurantWithManagers,
  InviteManagerRequest,
  UpdateManagerPermissionsRequest,
  InviteResponse,
} from '../types/restaurant';

export class RestaurantService {
  private static readonly BASE_URL = `${CONFIG.API_BASE_URL}/api`;

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

  // Get user's restaurants
  // TODO: Backend endpoint /user/restaurants needs to be implemented
  static async getUserRestaurants(): Promise<Restaurant[]> {
    try {
      const response = await fetch(`${this.BASE_URL}/user/restaurants`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      return this.handleResponse<Restaurant[]>(response);
    } catch (error) {
      // Fallback: return empty array if endpoint doesn't exist yet
      if (error instanceof Error && error.message.includes('404')) {
        console.warn('GET /user/restaurants endpoint not implemented yet');
        return [];
      }
      throw error;
    }
  }

  // Get restaurant details
  static async getRestaurant(id: string): Promise<Restaurant> {
    const response = await fetch(`${this.BASE_URL}/restaurants/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<Restaurant>(response);
  }

  // Get restaurant with managers
  static async getRestaurantWithManagers(id: string): Promise<RestaurantWithManagers> {
    const [restaurant, managers] = await Promise.all([
      this.getRestaurant(id),
      this.getRestaurantManagers(id),
    ]);

    return { restaurant, managers };
  }

  // Create restaurant
  static async createRestaurant(data: CreateRestaurantRequest): Promise<Restaurant> {
    const response = await fetch(`${this.BASE_URL}/restaurants`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<Restaurant>(response);
  }

  // Update restaurant
  static async updateRestaurant(id: string, data: UpdateRestaurantRequest): Promise<Restaurant> {
    const response = await fetch(`${this.BASE_URL}/restaurants/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<Restaurant>(response);
  }

  // Delete restaurant
  static async deleteRestaurant(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/restaurants/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<void>(response);
  }

  // Manager management
  static async getRestaurantManagers(id: string): Promise<ManagerInfo[]> {
    const response = await fetch(`${this.BASE_URL}/restaurants/${id}/managers`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ManagerInfo[]>(response);
  }

  // Invite manager
  static async inviteManager(restaurantId: string, data: InviteManagerRequest): Promise<InviteResponse> {
    const response = await fetch(`${this.BASE_URL}/restaurants/${restaurantId}/managers/invite`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<InviteResponse>(response);
  }

  // Update manager permissions
  static async updateManagerPermissions(
    restaurantId: string,
    userId: string,
    data: UpdateManagerPermissionsRequest
  ): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/restaurants/${restaurantId}/managers/${userId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<void>(response);
  }

  // Remove manager
  static async removeManager(restaurantId: string, userId: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/restaurants/${restaurantId}/managers/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<void>(response);
  }
}