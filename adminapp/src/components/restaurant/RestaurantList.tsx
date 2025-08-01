import { Show, For, createSignal } from 'solid-js';
import { useRestaurant } from '../../contexts/RestaurantContext';
import type { Restaurant } from '../../types/restaurant';

interface RestaurantListProps {
  onEdit: (restaurant: Restaurant) => void;
  onView: (restaurant: Restaurant) => void;
}

function RestaurantList(props: RestaurantListProps) {
  const restaurant = useRestaurant();
  const [deletingId, setDeletingId] = createSignal<string | null>(null);

  const handleDelete = async (restaurantToDelete: Restaurant) => {
    if (!confirm(`Are you sure you want to delete "${restaurantToDelete.name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(restaurantToDelete.id);
    try {
      await restaurant.deleteRestaurant(restaurantToDelete.id);
    } catch (error) {
      // Error is handled by context
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div class="px-4 py-5 sm:p-6">
      <Show 
        when={!restaurant.isLoading || restaurant.restaurants.length > 0} 
        fallback={
          <div class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div class="animate-spin mx-auto mt-4 h-6 w-6 text-indigo-600"></div>
            <p class="mt-2 text-sm text-gray-500">Loading restaurants...</p>
          </div>
        }
      >
        <Show 
          when={restaurant.restaurants.length > 0} 
          fallback={
            <div class="text-center py-12">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No restaurants</h3>
              <p class="mt-1 text-sm text-gray-500">Get started by creating your first restaurant.</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <For each={restaurant.restaurants}>
              {(restaurantItem) => (
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <div class="p-6">
                    <div class="flex items-center justify-between">
                      <h3 class="text-lg font-medium text-gray-900 truncate">
                        {restaurantItem.name}
                      </h3>
                      <div class="flex items-center space-x-2">
                        <button
                          onClick={() => props.onView(restaurantItem)}
                          class="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          title="View details"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => props.onEdit(restaurantItem)}
                          class="text-gray-600 hover:text-gray-900 text-sm font-medium"
                          title="Edit restaurant"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(restaurantItem)}
                          disabled={deletingId() === restaurantItem.id}
                          class="text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50"
                          title="Delete restaurant"
                        >
                          <Show 
                            when={deletingId() !== restaurantItem.id} 
                            fallback={
                              <div class="animate-spin h-5 w-5">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24">
                                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </div>
                            }
                          >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Show>
                        </button>
                      </div>
                    </div>
                    
                    <div class="mt-4 space-y-2">
                      <Show when={restaurantItem.address}>
                        <p class="text-sm text-gray-600 flex items-center">
                          <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span class="truncate">{restaurantItem.address}</span>
                        </p>
                      </Show>
                      
                      <Show when={restaurantItem.establishment_year}>
                        <p class="text-sm text-gray-600 flex items-center">
                          <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Est. {restaurantItem.establishment_year}
                        </p>
                      </Show>
                      
                      <p class="text-sm text-gray-500 flex items-center">
                        <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Created {formatDate(restaurantItem.created_at)}
                      </p>
                    </div>
                    
                    <Show when={restaurantItem.google_maps_link}>
                      <div class="mt-4">
                        <a
                          href={restaurantItem.google_maps_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View on Maps
                        </a>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

export default RestaurantList;