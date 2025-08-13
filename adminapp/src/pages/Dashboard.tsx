import { createSignal } from 'solid-js';

function Dashboard() {
  const [message] = createSignal('Welcome to LetsOrder Admin Dashboard!');

  return (
    <div class="p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">Getting Started</h2>
        <p class="text-gray-600 mb-6">{message()}</p>
        <div class="grid grid-cols-1 gap-4">
          <a
            href="/restaurants"
            class="block p-6 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
          >
            <h3 class="font-semibold text-blue-900">Restaurants</h3>
            <p class="text-blue-800 text-sm mt-1">
              Manage your restaurant information and settings
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
