import {
  createContext,
  createSignal,
  useContext,
  createEffect,
  ParentComponent,
} from 'solid-js';
import { RestaurantService } from '../services/restaurant';
import { useAuth } from './AuthContext';
import type {
  Restaurant,
  CreateRestaurantRequest,
  UpdateRestaurantRequest,
  ManagerInfo,
  InviteManagerRequest,
  UpdateManagerPermissionsRequest,
  RestaurantState,
} from '../types/restaurant';

interface RestaurantContextType extends RestaurantState {
  // Restaurant CRUD
  loadUserRestaurants: () => Promise<void>;
  createRestaurant: (data: CreateRestaurantRequest) => Promise<Restaurant>;
  updateRestaurant: (
    id: string,
    data: UpdateRestaurantRequest
  ) => Promise<Restaurant>;
  deleteRestaurant: (id: string) => Promise<void>;

  // Manager management
  loadRestaurantManagers: (restaurantId: string) => Promise<void>;
  inviteManager: (
    restaurantId: string,
    data: InviteManagerRequest
  ) => Promise<void>;
  updateManagerPermissions: (
    restaurantId: string,
    userId: string,
    data: UpdateManagerPermissionsRequest
  ) => Promise<void>;
  removeManager: (restaurantId: string, userId: string) => Promise<void>;

  // UI state
  setCurrentRestaurant: (restaurant: Restaurant | null) => void;
  clearError: () => void;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(
  undefined
);

export const RestaurantProvider: ParentComponent = (props) => {
  const auth = useAuth();
  const [restaurants, setRestaurants] = createSignal<Restaurant[]>([]);
  const [currentRestaurant, setCurrentRestaurant] =
    createSignal<Restaurant | null>(null);
  const [managers, setManagers] = createSignal<ManagerInfo[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Load user's restaurants only when authenticated
  createEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading) {
      loadUserRestaurants();
    }
  });

  // Persist selected restaurant in localStorage
  createEffect(() => {
    const current = currentRestaurant();
    if (current) {
      localStorage.setItem('selectedRestaurantId', current.id);
    } else {
      localStorage.removeItem('selectedRestaurantId');
    }
  });

  // Auto-select restaurant from localStorage or first available
  createEffect(() => {
    const restaurantList = restaurants();
    if (restaurantList.length > 0 && !currentRestaurant()) {
      const savedId = localStorage.getItem('selectedRestaurantId');
      let restaurantToSelect = restaurantList.find(r => r.id === savedId);
      
      // If saved restaurant not found, select the first one
      if (!restaurantToSelect) {
        restaurantToSelect = restaurantList[0];
      }
      
      setCurrentRestaurant(restaurantToSelect);
    }
  });

  const clearError = () => {
    setError(null);
  };

  const handleError = (err: unknown) => {
    const errorMessage =
      err instanceof Error ? err.message : 'An unexpected error occurred';
    setError(errorMessage);
    console.error('Restaurant operation error:', err);
  };

  // Restaurant CRUD operations
  const loadUserRestaurants = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userRestaurants = await RestaurantService.getUserRestaurants();
      setRestaurants(userRestaurants);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const createRestaurant = async (
    data: CreateRestaurantRequest
  ): Promise<Restaurant> => {
    setIsLoading(true);
    setError(null);

    try {
      const newRestaurant = await RestaurantService.createRestaurant(data);
      setRestaurants((prev) => [...prev, newRestaurant]);
      return newRestaurant;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateRestaurant = async (
    id: string,
    data: UpdateRestaurantRequest
  ): Promise<Restaurant> => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedRestaurant = await RestaurantService.updateRestaurant(
        id,
        data
      );
      setRestaurants((prev) =>
        prev.map((r) => (r.id === id ? updatedRestaurant : r))
      );

      // Update current restaurant if it's the one being updated
      if (currentRestaurant()?.id === id) {
        setCurrentRestaurant(updatedRestaurant);
      }

      return updatedRestaurant;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRestaurant = async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await RestaurantService.deleteRestaurant(id);
      setRestaurants((prev) => prev.filter((r) => r.id !== id));

      // Clear current restaurant if it's the one being deleted
      if (currentRestaurant()?.id === id) {
        setCurrentRestaurant(null);
      }
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Manager management operations
  const loadRestaurantManagers = async (restaurantId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const restaurantManagers =
        await RestaurantService.getRestaurantManagers(restaurantId);
      setManagers(restaurantManagers);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const inviteManager = async (
    restaurantId: string,
    data: InviteManagerRequest
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await RestaurantService.inviteManager(restaurantId, data);
      // Reload managers after successful invitation
      await loadRestaurantManagers(restaurantId);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateManagerPermissions = async (
    restaurantId: string,
    userId: string,
    data: UpdateManagerPermissionsRequest
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await RestaurantService.updateManagerPermissions(
        restaurantId,
        userId,
        data
      );
      // Reload managers after successful update
      await loadRestaurantManagers(restaurantId);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removeManager = async (
    restaurantId: string,
    userId: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await RestaurantService.removeManager(restaurantId, userId);
      // Reload managers after successful removal
      await loadRestaurantManagers(restaurantId);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: RestaurantContextType = {
    get restaurants() {
      return restaurants();
    },
    get currentRestaurant() {
      return currentRestaurant();
    },
    get managers() {
      return managers();
    },
    get isLoading() {
      return isLoading();
    },
    get error() {
      return error();
    },

    // Restaurant CRUD
    loadUserRestaurants,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,

    // Manager management
    loadRestaurantManagers,
    inviteManager,
    updateManagerPermissions,
    removeManager,

    // UI state
    setCurrentRestaurant,
    clearError,
  };

  return (
    <RestaurantContext.Provider value={contextValue}>
      {props.children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};
