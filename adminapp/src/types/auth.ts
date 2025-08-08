import { UserResponse as GeneratedUserResponse, AuthResponse as GeneratedAuthResponse } from './api';

// Use generated types with selective null to undefined conversion for optional fields only
export type User = {
  id: string;
  email: string;
  phone?: string;
  created_at: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

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
