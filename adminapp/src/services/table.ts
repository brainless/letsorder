import { config } from '../config/env';
import { TokenStorage } from './auth';
import type {
  Table,
  CreateTableRequest,
  UpdateTableRequest,
  QrCodeResponse,
  BulkQrCodeRequest,
  BulkQrCodeResponse,
  RefreshCodeResponse,
} from '../types/table';

export class TableService {
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

  // Table CRUD operations

  // Get tables for a restaurant
  static async getRestaurantTables(restaurantId: string): Promise<Table[]> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/tables`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<Table[]>(response);
  }

  // Get single table details
  static async getTable(restaurantId: string, tableId: string): Promise<Table> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/tables/${tableId}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<Table>(response);
  }

  // Create table
  static async createTable(
    restaurantId: string,
    data: Omit<CreateTableRequest, 'restaurant_id'>
  ): Promise<Table> {
    const requestData: CreateTableRequest = {
      ...data,
      restaurant_id: restaurantId,
    };

    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/tables`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestData),
      }
    );

    return this.handleResponse<Table>(response);
  }

  // Update table
  static async updateTable(
    restaurantId: string,
    tableId: string,
    data: UpdateTableRequest
  ): Promise<Table> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/tables/${tableId}`,
      {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }
    );

    return this.handleResponse<Table>(response);
  }

  // Delete table
  static async deleteTable(
    restaurantId: string,
    tableId: string
  ): Promise<void> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/tables/${tableId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<void>(response);
  }

  // QR Code operations

  // Get QR code for a table
  static async getTableQRCode(
    restaurantId: string,
    tableId: string
  ): Promise<QrCodeResponse> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/tables/${tableId}/qr`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<QrCodeResponse>(response);
  }

  // Generate bulk QR codes
  static async generateBulkQRCodes(
    restaurantId: string,
    data: BulkQrCodeRequest
  ): Promise<BulkQrCodeResponse> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/qr/bulk`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }
    );

    return this.handleResponse<BulkQrCodeResponse>(response);
  }

  // Refresh table unique code
  static async refreshTableCode(
    restaurantId: string,
    tableId: string
  ): Promise<RefreshCodeResponse> {
    const response = await fetch(
      `${this.BASE_URL}/restaurants/${restaurantId}/tables/${tableId}/refresh-code`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<RefreshCodeResponse>(response);
  }

  // Utility methods

  // Generate printable QR code URL (for external QR service or internal generator)
  static generatePrintableQRUrl(qrUrl: string, size: number = 256): string {
    // Using QR Server API for demonstration - in production you might want to use your own service
    const encodedUrl = encodeURIComponent(`${config.menuUrl}${qrUrl}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}`;
  }

  // Get menu URL for table
  static getMenuUrl(restaurantId: string, uniqueCode: string): string {
    return `${config.menuUrl}/m/${restaurantId}/${uniqueCode}`;
  }
}
