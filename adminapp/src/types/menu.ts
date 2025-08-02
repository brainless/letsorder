export interface MenuSection {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  section_id: string;
  name: string;
  description?: string;
  price: number;
  available: boolean;
  display_order: number;
  created_at: string;
}

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

export interface MenuSectionWithItems extends MenuSection {
  items: MenuItem[];
}

export interface RestaurantMenu {
  restaurant_id: string;
  sections: MenuSectionWithItems[];
}

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
