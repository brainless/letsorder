import { createSignal } from 'solid-js';

function Dashboard() {
  const [message] = createSignal('Welcome to LetsOrder Admin Dashboard!');

  return (
    <div class="p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">Getting Started</h2>
        <p class="text-gray-600 mb-6">{message()}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/restaurants"
            class="block p-6 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
          >
            <h3 class="font-semibold text-blue-900">Restaurants</h3>
            <p class="text-blue-800 text-sm mt-1">
              Manage your restaurant information and settings
            </p>
          </a>

          <a
            href="#"
            class="block p-6 bg-green-50 rounded-lg border border-green-200 opacity-50 cursor-not-allowed"
          >
            <h3 class="font-semibold text-green-900">Menu Management</h3>
            <p class="text-green-800 text-sm mt-1">
              Create and manage your restaurant menu (Coming Soon)
            </p>
          </a>

          <a
            href="#"
            class="block p-6 bg-purple-50 rounded-lg border border-purple-200 opacity-50 cursor-not-allowed"
          >
            <h3 class="font-semibold text-purple-900">Tables & QR Codes</h3>
            <p class="text-purple-800 text-sm mt-1">
              Set up tables and generate QR codes (Coming Soon)
            </p>
          </a>

          <a
            href="#"
            class="block p-6 bg-orange-50 rounded-lg border border-orange-200 opacity-50 cursor-not-allowed"
          >
            <h3 class="font-semibold text-orange-900">Order Management</h3>
            <p class="text-orange-800 text-sm mt-1">
              View and manage incoming orders (Coming Soon)
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
