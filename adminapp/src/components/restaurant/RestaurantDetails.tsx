import { Show, For, createSignal, createEffect } from 'solid-js';
import { useRestaurant } from '../../contexts/RestaurantContext';
import ManagerInviteForm from './ManagerInviteForm';
import type { Restaurant, ManagerInfo } from '../../types/restaurant';

interface RestaurantDetailsProps {
  restaurant: Restaurant;
  onEdit: () => void;
}

function RestaurantDetails(props: RestaurantDetailsProps) {
  const restaurant = useRestaurant();
  const [showInviteForm, setShowInviteForm] = createSignal(false);
  const [removingManagerId, setRemovingManagerId] = createSignal<string | null>(null);

  // Load managers when restaurant changes
  createEffect(() => {
    restaurant.loadRestaurantManagers(props.restaurant.id);
  });

  const handleRemoveManager = async (manager: ManagerInfo) => {
    if (!confirm(`Are you sure you want to remove ${manager.email} from the restaurant?`)) {
      return;
    }

    setRemovingManagerId(manager.user_id);
    try {
      await restaurant.removeManager(props.restaurant.id, manager.user_id);
    } catch (error) {
      // Error handled by context
    } finally {
      setRemovingManagerId(null);
    }
  };

  const handleInviteSuccess = () => {
    setShowInviteForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRoleBadgeClass = (role: string) => {
    return role === 'super_admin' 
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-blue-100 text-blue-800';
  };

  return (
    <div class="px-4 py-5 sm:p-6">
      {/* Restaurant Information */}
      <div class="mb-8">
        <div class="flex justify-between items-start mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">{props.restaurant.name}</h2>
            <p class="text-sm text-gray-500 mt-1">
              Created on {formatDate(props.restaurant.created_at)}
            </p>
          </div>
          <button
            onClick={props.onEdit}
            class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Restaurant
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div class="space-y-4">
            <Show when={props.restaurant.address}>
              <div>
                <dt class="text-sm font-medium text-gray-500">Address</dt>
                <dd class="mt-1 text-sm text-gray-900">{props.restaurant.address}</dd>
              </div>
            </Show>

            <Show when={props.restaurant.establishment_year}>
              <div>
                <dt class="text-sm font-medium text-gray-500">Established</dt>
                <dd class="mt-1 text-sm text-gray-900">{props.restaurant.establishment_year}</dd>
              </div>
            </Show>
          </div>

          <div class="space-y-4">
            <Show when={props.restaurant.google_maps_link}>
              <div>
                <dt class="text-sm font-medium text-gray-500">Location</dt>
                <dd class="mt-1">
                  <a
                    href={props.restaurant.google_maps_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                  >
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on Google Maps
                  </a>
                </dd>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Managers Section */}
      <div class="border-t pt-8">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h3 class="text-lg font-medium text-gray-900">Restaurant Managers</h3>
            <p class="text-sm text-gray-500 mt-1">
              Manage who has access to this restaurant
            </p>
          </div>
          <button
            onClick={() => setShowInviteForm(true)}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Invite Manager
          </button>
        </div>

        <Show when={showInviteForm()}>
          <div class="mb-6 p-4 bg-gray-50 rounded-lg">
            <ManagerInviteForm
              restaurantId={props.restaurant.id}
              onSuccess={handleInviteSuccess}
              onCancel={() => setShowInviteForm(false)}
            />
          </div>
        </Show>

        <Show 
          when={!restaurant.isLoading && restaurant.managers.length > 0} 
          fallback={
            <Show when={restaurant.isLoading}>
              <div class="text-center py-8">
                <div class="animate-spin mx-auto h-6 w-6 text-indigo-600"></div>
                <p class="mt-2 text-sm text-gray-500">Loading managers...</p>
              </div>
            </Show>
          }
        >
          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <ul class="divide-y divide-gray-200">
              <For each={restaurant.managers}>
                {(manager) => (
                  <li class="px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center">
                        <div class="flex-shrink-0">
                          <div class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <svg class="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        </div>
                        <div class="ml-4">
                          <div class="flex items-center">
                            <p class="text-sm font-medium text-gray-900">{manager.email}</p>
                            <span class={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(manager.role)}`}>
                              {manager.role === 'super_admin' ? 'Super Admin' : 'Manager'}
                            </span>
                          </div>
                          <div class="flex items-center mt-1">
                            <Show when={manager.phone}>
                              <p class="text-sm text-gray-500 mr-4">{manager.phone}</p>
                            </Show>
                            <Show when={manager.can_manage_menu}>
                              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Can manage menu
                              </span>
                            </Show>
                          </div>
                          <p class="text-xs text-gray-400 mt-1">
                            Added {formatDate(manager.created_at)}
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center space-x-2">
                        <Show when={manager.role !== 'super_admin'}>
                          <button
                            onClick={() => handleRemoveManager(manager)}
                            disabled={removingManagerId() === manager.user_id}
                            class="text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50"
                          >
                            <Show 
                              when={removingManagerId() !== manager.user_id} 
                              fallback={
                                <div class="animate-spin h-4 w-4">
                                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </div>
                              }
                            >
                              Remove
                            </Show>
                          </button>
                        </Show>
                      </div>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default RestaurantDetails;