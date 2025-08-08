import { Restaurant as GeneratedRestaurant } from './api';

// Use generated types
export type Restaurant = GeneratedRestaurant;

export interface CreateRestaurantRequest {
  name: string;
  address?: string;
  establishment_year?: number;
  google_maps_link?: string;
}

export interface UpdateRestaurantRequest {
  name?: string;
  address?: string;
  establishment_year?: number;
  google_maps_link?: string;
}

export interface ManagerInfo {
  user_id: string;
  email: string;
  phone?: string;
  role: 'super_admin' | 'manager';
  can_manage_menu: boolean;
  created_at: string;
}

export interface RestaurantWithManagers {
  restaurant: Restaurant;
  managers: ManagerInfo[];
}

export interface InviteManagerRequest {
  email: string;
  role: 'manager';
  can_manage_menu: boolean;
}

export interface UpdateManagerPermissionsRequest {
  role?: 'super_admin' | 'manager';
  can_manage_menu?: boolean;
}

export interface InviteResponse {
  message: string;
  user_id?: string;
}

// Frontend-specific types
export interface RestaurantState {
  restaurants: Restaurant[];
  currentRestaurant: Restaurant | null;
  managers: ManagerInfo[];
  isLoading: boolean;
  error: string | null;
}
