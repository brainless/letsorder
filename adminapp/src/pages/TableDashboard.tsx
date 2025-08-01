import { createSignal, Show, onMount } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useTable } from '../contexts/TableContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import TableList from '../components/table/TableList';
import TableForm from '../components/table/TableForm';
import QRCodeView from '../components/table/QRCodeView';
import BulkQRCodeView from '../components/table/BulkQRCodeView';
import type { Table, TableViewMode } from '../types/table';

function TableDashboard() {
  const params = useParams();
  const table = useTable();
  const restaurant = useRestaurant();
  const [viewMode, setViewMode] = createSignal<TableViewMode>('list');
  const [editingTable, setEditingTable] = createSignal<Table | null>(null);

  // Load restaurant and tables data on mount
  onMount(async () => {
    const restaurantId = params.restaurantId;
    if (restaurantId) {
      // Load restaurant details
      if (!restaurant.currentRestaurant || restaurant.currentRestaurant.id !== restaurantId) {
        // This should be handled by the parent route/component
        // For now, we'll assume the restaurant is already loaded
      }
      
      // Load tables for this restaurant
      await table.loadRestaurantTables(restaurantId);
    }
  });

  const handleCreateNew = () => {
    setEditingTable(null);
    setViewMode('create');
  };

  const handleEdit = (tableToEdit: Table) => {
    setEditingTable(tableToEdit);
    setViewMode('edit');
  };

  const handleShowQR = (tableToShow: Table) => {
    table.setCurrentTable(tableToShow);
    setViewMode('qr');
  };

  const handleBulkQR = () => {
    setViewMode('bulk-qr');
  };

  const handleFormSuccess = () => {
    setViewMode('list');
    setEditingTable(null);
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingTable(null);
    table.setCurrentTable(null);
  };

  const getPageTitle = () => {
    switch (viewMode()) {
      case 'create': return 'Create New Table';
      case 'edit': return 'Edit Table';
      case 'qr': return 'QR Code';
      case 'bulk-qr': return 'Bulk QR Codes';
      case 'print': return 'Print QR Codes';
      default: return 'Table Management';
    }
  };

  const getPageDescription = () => {
    switch (viewMode()) {
      case 'create': return 'Add a new table to your restaurant';
      case 'edit': return 'Update table information';
      case 'qr': return 'View and print QR code for table';
      case 'bulk-qr': return 'Generate QR codes for multiple tables';
      case 'print': return 'Print-ready QR codes';
      default: return 'Manage tables and QR codes for your restaurant';
    }
  };

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">
              {getPageTitle()}
            </h1>
            <p class="mt-2 text-gray-600">
              {getPageDescription()}
            </p>
            <Show when={restaurant.currentRestaurant}>
              <p class="mt-1 text-sm text-gray-500">
                Restaurant: {restaurant.currentRestaurant!.name}
              </p>
            </Show>
          </div>
          
          <Show when={viewMode() === 'list'}>
            <div class="flex space-x-3">
              <button
                onClick={handleBulkQR}
                disabled={table.tables.length === 0}
                class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 005 0z"></path>
                </svg>
                Bulk QR
              </button>
              <button
                onClick={handleCreateNew}
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add Table
              </button>
            </div>
          </Show>
          
          <Show when={viewMode() !== 'list'}>
            <button
              onClick={handleCancel}
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
      <Show when={table.error}>
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
                {table.error}
              </div>
            </div>
            <div class="ml-auto pl-3">
              <div class="-mx-1.5 -my-1.5">
                <button
                  onClick={table.clearError}
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
          <TableList 
            onEdit={handleEdit}
            onShowQR={handleShowQR}
          />
        </Show>
        
        <Show when={viewMode() === 'create'}>
          <TableForm
            restaurantId={params.restaurantId}
            onSuccess={handleFormSuccess}
            onCancel={handleCancel}
          />
        </Show>
        
        <Show when={viewMode() === 'edit'}>
          <TableForm
            restaurantId={params.restaurantId}
            table={editingTable()}
            onSuccess={handleFormSuccess}
            onCancel={handleCancel}
          />
        </Show>
        
        <Show when={viewMode() === 'qr'}>
          <QRCodeView
            table={table.currentTable!}
            restaurantId={params.restaurantId}
            onClose={handleCancel}
          />
        </Show>
        
        <Show when={viewMode() === 'bulk-qr'}>
          <BulkQRCodeView
            restaurantId={params.restaurantId}
            onClose={handleCancel}
          />
        </Show>
      </div>
    </div>
  );
}

export default TableDashboard;