import { Show, createSignal, createEffect, For } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useOrders } from '../contexts/OrderContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import type { OrderFilters, OrderStatus } from '../types/order';

function OrderDashboard() {
  const params = useParams();
  const orders = useOrders();
  const restaurants = useRestaurant();

  const [viewMode, setViewMode] = createSignal<'all' | 'today' | 'table'>(
    'today'
  );
  const [selectedTableId, setSelectedTableId] = createSignal<string>('');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<OrderStatus | ''>('');

  const restaurantId = () => params.restaurantId;

  // Load restaurant details
  createEffect(() => {
    const id = restaurantId();
    if (id) {
      restaurants.loadUserRestaurants();
    }
  });

  // Load orders based on view mode
  createEffect(() => {
    const id = restaurantId();
    const mode = viewMode();
    const tableId = selectedTableId();

    if (!id) return;

    switch (mode) {
      case 'today':
        orders.loadTodayOrders(id);
        break;
      case 'all':
        orders.loadOrders(id);
        break;
      case 'table':
        if (tableId) {
          orders.loadTableOrders(id, tableId);
        }
        break;
    }
  });

  // Update filters when search or status changes
  createEffect(() => {
    const filters: OrderFilters = {};

    if (searchTerm()) {
      filters.search = searchTerm();
    }

    if (statusFilter()) {
      filters.status = statusFilter() as OrderStatus;
    }

    if (viewMode() === 'table' && selectedTableId()) {
      filters.table_id = selectedTableId();
    }

    orders.setFilters(filters);
  });

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      await orders.updateOrderStatus(orderId, status);
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusOptions = (currentStatus: OrderStatus): OrderStatus[] => {
    // Define valid status transitions
    switch (currentStatus) {
      case 'pending':
        return ['confirmed', 'cancelled'];
      case 'confirmed':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['delivered'];
      case 'delivered':
      case 'cancelled':
        return []; // Final states, no transitions
      default:
        return [];
    }
  };

  return (
    <div class="p-6">
      {/* Header */}
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">Order Management</h1>
        <Show when={restaurants.currentRestaurant}>
          <p class="text-gray-600 mt-1">
            {restaurants.currentRestaurant?.name}
          </p>
        </Show>
      </div>

      {/* Stats Cards */}
      <Show when={orders.stats}>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Total Orders
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {orders.stats?.total_orders || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                      />
                    </svg>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Total Revenue
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {formatCurrency(orders.stats?.total_revenue || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Pending Orders
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {orders.stats?.pending_orders || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-500 truncate">
                      Avg Order Value
                    </dt>
                    <dd class="text-lg font-medium text-gray-900">
                      {formatCurrency(orders.stats?.average_order_value || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Controls */}
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* View Mode */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              View Mode
            </label>
            <select
              value={viewMode()}
              onChange={(e) =>
                setViewMode(e.currentTarget.value as 'all' | 'today' | 'table')
              }
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Today's Orders</option>
              <option value="all">All Orders</option>
              <option value="table">By Table</option>
            </select>
          </div>

          {/* Table Selection */}
          <Show when={viewMode() === 'table'}>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Select Table
              </label>
              <select
                value={selectedTableId()}
                onChange={(e) => setSelectedTableId(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a table...</option>
                {/* TODO: Load tables from restaurant context */}
              </select>
            </div>
          </Show>

          {/* Status Filter */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Status Filter
            </label>
            <select
              value={statusFilter()}
              onChange={(e) =>
                setStatusFilter(e.currentTarget.value as OrderStatus | '')
              }
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm()}
              onInput={(e) => setSearchTerm(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="mt-4 flex justify-between items-center">
          <button
            onClick={() => orders.refreshOrders()}
            disabled={orders.isLoading}
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <svg
              class="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      <Show when={orders.error}>
        <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-800">{orders.error}</p>
              <button
                onClick={() => orders.clearError()}
                class="mt-2 text-sm text-red-600 hover:text-red-500"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={orders.isLoading}>
        <div class="flex justify-center items-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span class="ml-3 text-gray-600">Loading orders...</span>
        </div>
      </Show>

      {/* Orders List */}
      <Show when={!orders.isLoading}>
        <div class="bg-white shadow rounded-lg overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">
              Orders ({orders.orders.length})
            </h3>
          </div>

          <Show
            when={orders.orders.length === 0}
            fallback={
              <div class="divide-y divide-gray-200">
                <For each={orders.orders}>
                  {(order) => (
                    <div class="p-6 hover:bg-gray-50">
                      <div class="flex items-center justify-between">
                        <div class="flex-1">
                          <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center space-x-3">
                              <h4 class="text-sm font-medium text-gray-900">
                                Order #{order.id.slice(-8)}
                              </h4>
                              <span
                                class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                              >
                                {order.status}
                              </span>
                            </div>
                            <div class="text-sm text-gray-500">
                              {formatDate(order.created_at)}
                            </div>
                          </div>

                          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p class="text-sm text-gray-600">
                                <span class="font-medium">Table:</span>{' '}
                                {order.table_name}
                              </p>
                              <Show when={order.customer_name}>
                                <p class="text-sm text-gray-600">
                                  <span class="font-medium">Customer:</span>{' '}
                                  {order.customer_name}
                                </p>
                              </Show>
                            </div>

                            <div>
                              <p class="text-sm text-gray-600">
                                <span class="font-medium">Items:</span>{' '}
                                {order.items.length}
                              </p>
                              <p class="text-sm text-gray-600">
                                <span class="font-medium">Total:</span>{' '}
                                {formatCurrency(order.total_amount)}
                              </p>
                            </div>

                            <div class="flex items-center space-x-2">
                              <Show
                                when={getStatusOptions(order.status).length > 0}
                              >
                                <select
                                  onChange={(e) =>
                                    handleStatusUpdate(
                                      order.id,
                                      e.currentTarget.value as OrderStatus
                                    )
                                  }
                                  class="text-sm border border-gray-300 rounded px-2 py-1"
                                >
                                  <option value="">Update Status</option>
                                  <For each={getStatusOptions(order.status)}>
                                    {(status) => (
                                      <option value={status}>
                                        {status.charAt(0).toUpperCase() +
                                          status.slice(1)}
                                      </option>
                                    )}
                                  </For>
                                </select>
                              </Show>

                              <button
                                class="text-sm text-blue-600 hover:text-blue-500"
                                onClick={() => {
                                  // TODO: Open order details modal
                                  console.log('View order details:', order.id);
                                }}
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            }
          >
            <div class="text-center py-12">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">
                No orders found
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                No orders match your current filters.
              </p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default OrderDashboard;
