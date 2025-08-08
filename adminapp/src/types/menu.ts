import { 
  MenuSection as GeneratedMenuSection, 
  MenuItem as GeneratedMenuItem,
  MenuSectionWithItems as GeneratedMenuSectionWithItems,
  RestaurantMenu as GeneratedRestaurantMenu
} from './api';

// Use generated types
export type MenuSection = GeneratedMenuSection;
export type MenuItem = GeneratedMenuItem;

export interface CreateMenuSectionRequest {
  name: string;
  display_order?: number;
}

export interface UpdateMenuSectionRequest {
  name?: string;
  display_order?: number;
}

export interface CreateMenuItemRequest {
  name: string;
  description?: string;
  price: number;
  display_order?: number;
}

export interface UpdateMenuItemRequest {
  name?: string;
  description?: string;
  price?: number;
  display_order?: number;
}

export interface SectionOrder {
  section_id: string;
  display_order: number;
}

export interface ReorderSectionsRequest {
  section_orders: SectionOrder[];
}

export interface ItemOrder {
  item_id: string;
  display_order: number;
}

export interface ReorderItemsRequest {
  item_orders: ItemOrder[];
}

export interface ToggleAvailabilityRequest {
  available: boolean;
}

export type MenuSectionWithItems = GeneratedMenuSectionWithItems;
export type RestaurantMenu = GeneratedRestaurantMenu;

// Frontend-specific types
export interface MenuState {
  sections: MenuSectionWithItems[];
  isLoading: boolean;
  error: string | null;
  selectedSection: MenuSection | null;
  selectedItem: MenuItem | null;
}

export interface BulkOperation {
  type: 'delete' | 'toggle_availability';
  itemIds: string[];
  sectionIds?: string[];
  available?: boolean;
}
