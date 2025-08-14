import { createSignal, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useRestaurant } from '../contexts/RestaurantContext';

function Header() {
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const [restaurantMenuOpen, setRestaurantMenuOpen] = createSignal(false);
  const auth = useAuth();
  const ui = useUI();
  const restaurant = useRestaurant();
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.logout();
    setUserMenuOpen(false);
  };

  const handleRestaurantSelect = (selectedRestaurant: typeof restaurant.currentRestaurant) => {
    restaurant.setCurrentRestaurant(selectedRestaurant);
    setRestaurantMenuOpen(false);
    if (selectedRestaurant) {
      navigate(`/restaurants/${selectedRestaurant.id}`);
    }
  };

  const getUserInitials = () => {
    if (!auth.user?.email) return 'U';
    return auth.user.email.charAt(0).toUpperCase();
  };

  const getUserDisplayName = () => {
    return auth.user?.email || 'User';
  };

  return (
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        class="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        onClick={ui.toggleSidebar}
      >
        <span class="sr-only">Open sidebar</span>
        <svg
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>

      {/* Separator */}
      <div class="h-6 w-px bg-gray-900/10 lg:hidden" aria-hidden="true" />

      <div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div class="relative flex flex-1">
          <a
            href="/"
            class="text-xl font-semibold text-gray-900 self-center hover:text-gray-700 transition-colors"
          >
            Admin
          </a>
        </div>

        {/* Restaurant selector dropdown */}
        <Show when={auth.isAuthenticated && restaurant.restaurants.length > 0}>
          <div class="flex items-center">
            <div class="relative">
              <button
                type="button"
                class="flex items-center gap-x-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300"
                onClick={() => setRestaurantMenuOpen(!restaurantMenuOpen())}
              >
                <span class="text-lg">🏪</span>
                <span class="max-w-32 truncate">
                  {restaurant.currentRestaurant?.name || 'Select Restaurant'}
                </span>
                <svg
                  class="h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>

              <Show when={restaurantMenuOpen()}>
                <div
                  class="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5"
                  onClick={() => setRestaurantMenuOpen(false)}
                >
                  <div class="px-3 py-2 border-b border-gray-100">
                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Select Restaurant
                    </p>
                  </div>
                  <For each={restaurant.restaurants}>
                    {(rest) => (
                      <button
                        onClick={() => handleRestaurantSelect(rest)}
                        class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          restaurant.currentRestaurant?.id === rest.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-900'
                        }`}
                      >
                        <div class="flex items-center gap-x-2">
                          <span class="text-base">🏪</span>
                          <div class="flex-1 min-w-0">
                            <p class="truncate">{rest.name}</p>
                            <p class="text-xs text-gray-500 truncate">{rest.address}</p>
                          </div>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        <div class="flex items-center gap-x-4 lg:gap-x-6">
          <Show when={auth.isAuthenticated}>
            {/* Profile dropdown */}
            <div class="relative">
              <button
                type="button"
                class="-m-1.5 flex items-center p-1.5"
                onClick={() => setUserMenuOpen(!userMenuOpen())}
              >
                <span class="sr-only">Open user menu</span>
                <div class="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <span class="text-sm font-medium text-white">
                    {getUserInitials()}
                  </span>
                </div>
                <span class="hidden lg:flex lg:items-center">
                  <span class="ml-4 text-sm font-semibold leading-6 text-gray-900">
                    {getUserDisplayName()}
                  </span>
                </span>
              </button>

              <Show when={userMenuOpen()}>
                <div
                  class="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <div class="px-3 py-2 border-b border-gray-100">
                    <p class="text-sm font-medium text-gray-900">
                      {getUserDisplayName()}
                    </p>
                    <p class="text-xs text-gray-500">Restaurant Manager</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    class="block w-full text-left px-3 py-2 text-sm leading-6 text-gray-900 hover:bg-gray-50"
                  >
                    Sign out
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default Header;
