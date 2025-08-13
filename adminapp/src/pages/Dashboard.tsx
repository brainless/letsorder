import { createSignal, Show, For } from 'solid-js';
import { A } from '@solidjs/router';
import { useRestaurant } from '../contexts/RestaurantContext';

function Dashboard() {
  const [message] = createSignal('Welcome to LetsOrder Admin Dashboard!');
  const restaurant = useRestaurant();

  const mainFeatures = [
    {
      name: 'Menu Management',
      href: () => restaurant.currentRestaurant ? `/restaurants/${restaurant.currentRestaurant.id}/menu` : '#',
      icon: '📋',
      description: 'Create and manage your restaurant menu items and sections'
    },
    {
      name: 'Tables & QR Codes',
      href: () => restaurant.currentRestaurant ? `/restaurants/${restaurant.currentRestaurant.id}/tables` : '#',
      icon: '🏷️',
      description: 'Manage tables and generate QR codes for contactless ordering'
    },
    {
      name: 'Order Management',
      href: () => restaurant.currentRestaurant ? `/restaurants/${restaurant.currentRestaurant.id}/orders` : '#',
      icon: '📦',
      description: 'View and manage incoming orders from customers'
    }
  ];

  return (
    <div class="p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
      
      <Show 
        when={restaurant.restaurants.length > 0}
        fallback={
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
        }
      >
        <div class="bg-white shadow rounded-lg p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-xl font-semibold">Manage your Restaurant</h2>
              <Show when={restaurant.currentRestaurant}>
                <p class="text-gray-600 mt-1">
                  Currently managing: <span class="font-medium">{restaurant.currentRestaurant?.name}</span>
                </p>
              </Show>
            </div>
            <A
              href="/restaurants"
              class="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All Restaurants →
            </A>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <For each={mainFeatures}>
              {(feature) => (
                <A
                  href={feature.href()}
                  class={`block p-6 rounded-lg transition-colors border ${
                    restaurant.currentRestaurant 
                      ? 'bg-blue-50 hover:bg-blue-100 border-blue-200' 
                      : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div class="flex items-center mb-3">
                    <span class="text-2xl mr-3">{feature.icon}</span>
                    <h3 class={`font-semibold ${
                      restaurant.currentRestaurant ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                      {feature.name}
                    </h3>
                  </div>
                  <p class={`text-sm ${
                    restaurant.currentRestaurant ? 'text-blue-800' : 'text-gray-600'
                  }`}>
                    {feature.description}
                  </p>
                </A>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default Dashboard;
