import { UserResponse, AuthResponse as GeneratedAuthResponse } from './api';

// Use generated types
export type User = UserResponse;
export type AuthResponse = GeneratedAuthResponse;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  phone?: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
