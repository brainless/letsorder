import { createSignal, Show, createEffect } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useRestaurant } from '../contexts/RestaurantContext';

function Dashboard() {
  const [message] = createSignal('Welcome to LetsOrder Admin Dashboard!');
  const restaurant = useRestaurant();
  const navigate = useNavigate();

  // Redirect to restaurant details page when a restaurant is selected
  createEffect(() => {
    if (restaurant.currentRestaurant && restaurant.restaurants.length > 0) {
      navigate(`/restaurants/${restaurant.currentRestaurant.id}`, { replace: true });
    }
  });


  return (
    <div class="p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
      
      {/* Only show content when there are no restaurants, otherwise redirect happens */}
      <Show when={restaurant.restaurants.length === 0}>
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-xl font-semibold mb-4">Welcome to LetsOrder!</h2>
          <p class="text-gray-600 mb-6">
            Get started by adding your restaurant to unlock powerful features for managing your business.
          </p>
          <div class="mb-6">
            <A
              href="/restaurants"
              class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <span class="mr-2">🏪</span>
              Add your Restaurant
            </A>
          </div>
          <div class="border-t border-gray-200 pt-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Features you'll get:</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-4 bg-gray-50 rounded-lg">
                <div class="text-2xl mb-2">📋</div>
                <h4 class="font-medium text-gray-900">Menu Management</h4>
                <p class="text-sm text-gray-600 mt-1">
                  Create and organize your menu with sections and items
                </p>
              </div>
              <div class="p-4 bg-gray-50 rounded-lg">
                <div class="text-2xl mb-2">🏷️</div>
                <h4 class="font-medium text-gray-900">QR Code Generation</h4>
                <p class="text-sm text-gray-600 mt-1">
                  Generate QR codes for tables enabling contactless ordering
                </p>
              </div>
              <div class="p-4 bg-gray-50 rounded-lg">
                <div class="text-2xl mb-2">📦</div>
                <h4 class="font-medium text-gray-900">Order Tracking</h4>
                <p class="text-sm text-gray-600 mt-1">
                  Real-time order notifications and management dashboard
                </p>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default Dashboard;
