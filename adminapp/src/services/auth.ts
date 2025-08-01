import { config } from '../config/env';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../types/auth';

const API_BASE = config.apiUrl;

export class AuthService {
  private static getAuthHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || `Login failed: ${response.status}`);
    }

    return response.json();
  }

  static async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(error.error || `Registration failed: ${response.status}`);
    }

    return response.json();
  }

  static async validateToken(token: string): Promise<boolean> {
    try {
      console.log('Validating token with backend:', `${API_BASE}/api/test`);
      const response = await fetch(`${API_BASE}/api/test`, {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      });
      
      console.log('Token validation response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      return response.ok;
    } catch (error) {
      console.error('Token validation network error:', error);
      // On network errors, assume token is still valid to avoid unnecessary logouts
      // The token expiration check will handle truly expired tokens
      return true;
    }
  }
}

export class TokenStorage {
  private static readonly TOKEN_KEY = 'letsorder_token';
  private static readonly USER_KEY = 'letsorder_user';

  static saveToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static saveUser(user: any): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static getUser(): any | null {
    const userData = localStorage.getItem(this.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  static removeUser(): void {
    localStorage.removeItem(this.USER_KEY);
  }

  static clear(): void {
    this.removeToken();
    this.removeUser();
  }

  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}