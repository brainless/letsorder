import { createSignal, Show, For } from 'solid-js';
import { useRestaurant } from '../contexts/RestaurantContext';
import RestaurantList from '../components/restaurant/RestaurantList';
import RestaurantForm from '../components/restaurant/RestaurantForm';
import RestaurantDetails from '../components/restaurant/RestaurantDetails';
import type { Restaurant } from '../types/restaurant';

type ViewMode = 'list' | 'create' | 'edit' | 'details';

function RestaurantDashboard() {
  const restaurant = useRestaurant();
  const [viewMode, setViewMode] = createSignal<ViewMode>('list');
  const [editingRestaurant, setEditingRestaurant] = createSignal<Restaurant | null>(null);

  const handleCreateNew = () => {
    setEditingRestaurant(null);
    setViewMode('create');
  };

  const handleEdit = (restaurantToEdit: Restaurant) => {
    setEditingRestaurant(restaurantToEdit);
    setViewMode('edit');
  };

  const handleView = (restaurantToView: Restaurant) => {
    restaurant.setCurrentRestaurant(restaurantToView);
    setViewMode('details');
  };

  const handleFormSuccess = (newRestaurant: Restaurant) => {
    setViewMode('list');
    setEditingRestaurant(null);
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingRestaurant(null);
  };

  const handleBackToList = () => {
    setViewMode('list');
    restaurant.setCurrentRestaurant(null);
  };

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">
              <Show 
                when={viewMode() === 'list'} 
                fallback={
                  <Show 
                    when={viewMode() === 'create'} 
                    fallback={
                      <Show 
                        when={viewMode() === 'edit'} 
                        fallback="Restaurant Details"
                      >
                        Edit Restaurant
                      </Show>
                    }
                  >
                    Create New Restaurant
                  </Show>
                }
              >
                Restaurant Management
              </Show>
            </h1>
            <p class="mt-2 text-gray-600">
              <Show 
                when={viewMode() === 'list'} 
                fallback={
                  <Show 
                    when={viewMode() === 'create'} 
                    fallback={
                      <Show 
                        when={viewMode() === 'edit'} 
                        fallback="View and manage restaurant details"
                      >
                        Update restaurant information
                      </Show>
                    }
                  >
                    Add a new restaurant to your management portfolio
                  </Show>
                }
              >
                Manage your restaurants and their settings
              </Show>
            </p>
          </div>
          
          <Show when={viewMode() === 'list'}>
            <button
              onClick={handleCreateNew}
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Add Restaurant
            </button>
          </Show>
          
          <Show when={viewMode() !== 'list'}>
            <button
              onClick={viewMode() === 'details' ? handleBackToList : handleCancel}
              class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to List
            </button>
          </Show>
        </div>
      </div>

      {/* Error Display */}
      <Show when={restaurant.error}>
        <div class="mb-6 rounded-md bg-red-50 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Error</h3>
              <div class="mt-2 text-sm text-red-700">
                {restaurant.error}
              </div>
            </div>
            <div class="ml-auto pl-3">
              <div class="-mx-1.5 -my-1.5">
                <button
                  onClick={restaurant.clearError}
                  class="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                >
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Main Content */}
      <div class="bg-white shadow rounded-lg">
        <Show when={viewMode() === 'list'}>
          <RestaurantList 
            onEdit={handleEdit}
            onView={handleView}
          />
        </Show>
        
        <Show when={viewMode() === 'create'}>
          <RestaurantForm
            onSuccess={handleFormSuccess}
            onCancel={handleCancel}
          />
        </Show>
        
        <Show when={viewMode() === 'edit'}>
          <RestaurantForm
            restaurant={editingRestaurant()}
            onSuccess={handleFormSuccess}
            onCancel={handleCancel}
          />
        </Show>
        
        <Show when={viewMode() === 'details'}>
          <RestaurantDetails
            restaurant={restaurant.currentRestaurant!}
            onEdit={() => restaurant.currentRestaurant && handleEdit(restaurant.currentRestaurant)}
          />
        </Show>
      </div>
    </div>
  );
}

export default RestaurantDashboard;