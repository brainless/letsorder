import { createSignal } from 'solid-js';

function Dashboard() {
  const [message] = createSignal('Welcome to LetsOrder Admin Dashboard!');

  return (
    <div class="p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-2">Getting Started</h2>
        <p class="text-gray-600">{message()}</p>
        <div class="mt-4 space-y-2">
          <div class="p-4 bg-blue-50 rounded-md">
            <h3 class="font-medium text-blue-900">Restaurants</h3>
            <p class="text-blue-700 text-sm">Manage your restaurant information and settings</p>
          </div>
          <div class="p-4 bg-green-50 rounded-md">
            <h3 class="font-medium text-green-900">Menu</h3>
            <p class="text-green-700 text-sm">Create and manage your restaurant menu</p>
          </div>
          <div class="p-4 bg-purple-50 rounded-md">
            <h3 class="font-medium text-purple-900">Tables & QR Codes</h3>
            <p class="text-purple-700 text-sm">Set up tables and generate QR codes</p>
          </div>
          <div class="p-4 bg-orange-50 rounded-md">
            <h3 class="font-medium text-orange-900">Orders</h3>
            <p class="text-orange-700 text-sm">View and manage incoming orders</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;