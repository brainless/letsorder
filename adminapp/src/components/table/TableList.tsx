import { createSignal, Show, For } from 'solid-js';
import { useTable } from '../../contexts/TableContext';
import type { Table } from '../../types/table';

interface TableListProps {
  onEdit: (table: Table) => void;
  onShowQR: (table: Table) => void;
}

function TableList(props: TableListProps) {
  const table = useTable();
  const [selectedTables, setSelectedTables] = createSignal<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = createSignal<string | null>(null);

  const handleSelectTable = (tableId: string, selected: boolean) => {
    setSelectedTables(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(tableId);
      } else {
        newSet.delete(tableId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTables(new Set(table.filteredTables().map(t => t.id)));
    } else {
      setSelectedTables(new Set<string>());
    }
  };

  const handleDelete = async (tableId: string) => {
    const tableToDelete = table.tables.find(t => t.id === tableId);
    if (!tableToDelete) return;

    try {
      // Get restaurant ID from the table (assuming we have access to it)
      await table.deleteTable(tableToDelete.restaurant_id, tableId);
      setDeleteConfirm(null);
    } catch (error) {
      // Error is handled by the context
      console.error('Failed to delete table:', error);
    }
  };

  const handleBulkDelete = async () => {
    const selected = Array.from(selectedTables());
    if (selected.length === 0) return;

    try {
      // Delete all selected tables
      const deleteTasks = selected.map(tableId => {
        const t = table.tables.find(tbl => tbl.id === tableId);
        return t ? table.deleteTable(t.restaurant_id, tableId) : Promise.resolve();
      });
      
      await Promise.all(deleteTasks);
      setSelectedTables(new Set<string>());
    } catch (error) {
      console.error('Failed to delete tables:', error);
    }
  };

  const handleRefreshCode = async (tableToRefresh: Table) => {
    try {
      await table.refreshTableCode(tableToRefresh.restaurant_id, tableToRefresh.id);
    } catch (error) {
      console.error('Failed to refresh table code:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTables = () => table.filteredTables();

  return (
    <div class="p-6">
      {/* Search and Filter Controls */}
      <div class="mb-6 flex flex-col sm:flex-row gap-4">
        <div class="flex-1">
          <label for="search" class="sr-only">Search tables</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              id="search"
              type="text"
              placeholder="Search by table name or code..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={table.getFilters().searchTerm}
              onInput={(e) => table.setFilters({ searchTerm: e.currentTarget.value })}
            />
          </div>
        </div>
        
        <div class="flex gap-2">
          <select
            class="block px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            value={table.getFilters().sortBy}
            onChange={(e) => table.setFilters({ sortBy: e.currentTarget.value as 'name' | 'created_at' })}
          >
            <option value="name">Sort by Name</option>
            <option value="created_at">Sort by Date</option>
          </select>
          
          <button
            onClick={() => table.setFilters({ 
              sortOrder: table.getFilters().sortOrder === 'asc' ? 'desc' : 'asc' 
            })}
            class="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {table.getFilters().sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      <Show when={selectedTables().size > 0}>
        <div class="mb-4 flex items-center justify-between bg-indigo-50 px-4 py-3 rounded-md">
          <span class="text-sm text-indigo-700">
            {selectedTables().size} table{selectedTables().size > 1 ? 's' : ''} selected
          </span>
          <div class="flex gap-2">
            <button
              onClick={handleBulkDelete}
              class="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedTables(new Set())}
              class="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={table.isLoading}>
        <div class="flex justify-center py-8">
          <div class="animate-spin h-8 w-8 text-indigo-600">
            <svg fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
      </Show>

      {/* Empty State */}
      <Show when={!table.isLoading && filteredTables().length === 0 && table.tables.length === 0}>
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No tables</h3>
          <p class="mt-1 text-sm text-gray-500">Get started by creating your first table.</p>
        </div>
      </Show>

      {/* No Search Results */}
      <Show when={!table.isLoading && filteredTables().length === 0 && table.tables.length > 0}>
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No tables found</h3>
          <p class="mt-1 text-sm text-gray-500">Try adjusting your search terms.</p>
        </div>
      </Show>

      {/* Tables Grid */}
      <Show when={!table.isLoading && filteredTables().length > 0}>
        <div class="space-y-4">
          {/* Header with select all */}
          <div class="flex items-center pb-2 border-b border-gray-200">
            <label class="flex items-center">
              <input
                type="checkbox"
                checked={selectedTables().size === filteredTables().length && filteredTables().length > 0}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = selectedTables().size > 0 && selectedTables().size < filteredTables().length;
                  }
                }}
                onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span class="ml-2 text-sm text-gray-600">
                Select all ({filteredTables().length})
              </span>
            </label>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={filteredTables()}>
              {(tableItem) => (
                <div class="relative bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  {/* Selection checkbox */}
                  <div class="absolute top-2 left-2">
                    <input
                      type="checkbox"
                      checked={selectedTables().has(tableItem.id)}
                      onChange={(e) => handleSelectTable(tableItem.id, e.currentTarget.checked)}
                      class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>

                  <div class="ml-6">
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0">
                        <h3 class="text-lg font-semibold text-gray-900 truncate">
                          {tableItem.name}
                        </h3>
                        <p class="text-sm text-gray-500">
                          Code: <span class="font-mono text-gray-700">{tableItem.unique_code}</span>
                        </p>
                        <p class="text-xs text-gray-400 mt-1">
                          Created: {formatDate(tableItem.created_at)}
                        </p>
                      </div>
                    </div>

                    <div class="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => props.onShowQR(tableItem)}
                        class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12v4.01M12 12V7.99"></path>
                        </svg>
                        QR Code
                      </button>
                      
                      <button
                        onClick={() => props.onEdit(tableItem)}
                        class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Edit
                      </button>
                      
                      <button
                        onClick={() => handleRefreshCode(tableItem)}
                        class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Refresh
                      </button>
                      
                      <button
                        onClick={() => setDeleteConfirm(tableItem.id)}
                        class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Delete Confirmation Modal */}
      <Show when={deleteConfirm()}>
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3 text-center">
              <h3 class="text-lg font-medium text-gray-900">Delete Table</h3>
              <div class="mt-2 px-7 py-3">
                <p class="text-sm text-gray-500">
                  Are you sure you want to delete this table? This action cannot be undone.
                </p>
              </div>
              <div class="flex justify-center gap-4 px-4 py-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  class="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConfirm() && handleDelete(deleteConfirm()!)}
                  class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default TableList;