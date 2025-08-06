import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  ParentComponent,
} from 'solid-js';
import { MenuService } from '../services/menu';
import type {
  MenuState,
  MenuSection,
  MenuItem,
  MenuSectionWithItems,
  CreateMenuSectionRequest,
  UpdateMenuSectionRequest,
  CreateMenuItemRequest,
  UpdateMenuItemRequest,
  ReorderSectionsRequest,
  ReorderItemsRequest,
} from '../types/menu';

interface MenuContextType extends MenuState {
  // Actions
  loadMenu: (restaurantId: string) => Promise<void>;

  // Section actions
  createSection: (
    restaurantId: string,
    data: CreateMenuSectionRequest
  ) => Promise<void>;
  updateSection: (
    sectionId: string,
    data: UpdateMenuSectionRequest
  ) => Promise<void>;
  deleteSection: (sectionId: string) => Promise<void>;
  reorderSections: (data: ReorderSectionsRequest) => Promise<void>;

  // Item actions
  createItem: (sectionId: string, data: CreateMenuItemRequest) => Promise<void>;
  updateItem: (itemId: string, data: UpdateMenuItemRequest) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  toggleItemAvailability: (itemId: string, available: boolean) => Promise<void>;
  reorderItems: (data: ReorderItemsRequest) => Promise<void>;

  // Bulk actions
  bulkDeleteItems: (itemIds: string[]) => Promise<void>;
  bulkToggleAvailability: (
    itemIds: string[],
    available: boolean
  ) => Promise<void>;
  bulkDeleteSections: (sectionIds: string[]) => Promise<void>;

  // UI state
  setSelectedSection: (section: MenuSection | null) => void;
  setSelectedItem: (item: MenuItem | null) => void;
  clearError: () => void;
}

const MenuContext = createContext<MenuContextType>();

export const MenuProvider: ParentComponent<{ restaurantId?: string }> = (
  props
) => {
  const [sections, setSections] = createSignal<MenuSectionWithItems[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedSection, setSelectedSection] =
    createSignal<MenuSection | null>(null);
  const [selectedItem, setSelectedItem] = createSignal<MenuItem | null>(null);

  const handleError = (err: any) => {
    console.error('Menu operation error:', err);
    setError(err instanceof Error ? err.message : 'An error occurred');
  };

  const loadMenu = async (restaurantId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const menu = await MenuService.getRestaurantMenu(restaurantId);
      setSections(menu.sections);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Section actions
  const createSection = async (
    restaurantId: string,
    data: CreateMenuSectionRequest
  ) => {
    setError(null);
    try {
      await MenuService.createSection(restaurantId, data);
      await loadMenu(restaurantId);
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const updateSection = async (
    sectionId: string,
    data: UpdateMenuSectionRequest
  ) => {
    setError(null);
    try {
      await MenuService.updateSection(sectionId, data);
      // Update local state
      setSections((prev) =>
        prev.map((section) =>
          section.id === sectionId ? { ...section, ...data } : section
        )
      );
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const deleteSection = async (sectionId: string) => {
    setError(null);
    try {
      await MenuService.deleteSection(sectionId);
      setSections((prev) => prev.filter((section) => section.id !== sectionId));
      if (selectedSection()?.id === sectionId) {
        setSelectedSection(null);
      }
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const reorderSections = async (data: ReorderSectionsRequest) => {
    setError(null);
    try {
      await MenuService.reorderSections(data);
      // Update local display order
      setSections((prev) => {
        const updated = [...prev];
        data.section_orders.forEach((order) => {
          const section = updated.find((s) => s.id === order.section_id);
          if (section) {
            section.display_order = order.display_order;
          }
        });
        return updated.sort((a, b) => a.display_order - b.display_order);
      });
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  // Item actions
  const createItem = async (sectionId: string, data: CreateMenuItemRequest) => {
    setError(null);
    try {
      const newItem = await MenuService.createItem(sectionId, data);
      setSections((prev) =>
        prev.map((section) =>
          section.id === sectionId
            ? { ...section, items: [...section.items, newItem] }
            : section
        )
      );
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const updateItem = async (itemId: string, data: UpdateMenuItemRequest) => {
    setError(null);
    try {
      await MenuService.updateItem(itemId, data);
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.id === itemId ? { ...item, ...data } : item
          ),
        }))
      );
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const deleteItem = async (itemId: string) => {
    setError(null);
    try {
      await MenuService.deleteItem(itemId);
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          items: section.items.filter((item) => item.id !== itemId),
        }))
      );
      if (selectedItem()?.id === itemId) {
        setSelectedItem(null);
      }
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const toggleItemAvailability = async (itemId: string, available: boolean) => {
    setError(null);
    try {
      await MenuService.toggleItemAvailability(itemId, { available });
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.id === itemId ? { ...item, available } : item
          ),
        }))
      );
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const reorderItems = async (data: ReorderItemsRequest) => {
    setError(null);
    try {
      await MenuService.reorderItems(data);
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          items: section.items
            .map((item) => {
              const order = data.item_orders.find((o) => o.item_id === item.id);
              return order
                ? { ...item, display_order: order.display_order }
                : item;
            })
            .sort((a, b) => a.display_order - b.display_order),
        }))
      );
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  // Bulk actions
  const bulkDeleteItems = async (itemIds: string[]) => {
    setError(null);
    try {
      await MenuService.bulkDeleteItems(itemIds);
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          items: section.items.filter((item) => !itemIds.includes(item.id)),
        }))
      );
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const bulkToggleAvailability = async (
    itemIds: string[],
    available: boolean
  ) => {
    setError(null);
    try {
      await MenuService.bulkToggleAvailability(itemIds, available);
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            itemIds.includes(item.id) ? { ...item, available } : item
          ),
        }))
      );
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const bulkDeleteSections = async (sectionIds: string[]) => {
    setError(null);
    try {
      await MenuService.bulkDeleteSections(sectionIds);
      setSections((prev) =>
        prev.filter((section) => !sectionIds.includes(section.id))
      );
    } catch (err) {
      handleError(err);
      throw err;
    }
  };

  const clearError = () => setError(null);

  // Auto-load menu when restaurantId changes
  createEffect(() => {
    if (props.restaurantId) {
      loadMenu(props.restaurantId);
    }
  });

  const value: MenuContextType = {
    get sections() {
      return sections();
    },
    get isLoading() {
      return isLoading();
    },
    get error() {
      return error();
    },
    get selectedSection() {
      return selectedSection();
    },
    get selectedItem() {
      return selectedItem();
    },

    loadMenu,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    createItem,
    updateItem,
    deleteItem,
    toggleItemAvailability,
    reorderItems,
    bulkDeleteItems,
    bulkToggleAvailability,
    bulkDeleteSections,
    setSelectedSection,
    setSelectedItem,
    clearError,
  };

  return (
    <MenuContext.Provider value={value}>{props.children}</MenuContext.Provider>
  );
};

export const useMenu = () => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
};
