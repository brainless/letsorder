import { createSignal, Show } from 'solid-js';
import { useTable } from '../../contexts/TableContext';
import type { Table, TableFormData } from '../../types/table';

interface TableFormProps {
  table?: Table | null;
  restaurantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function TableForm(props: TableFormProps) {
  const table = useTable();
  const [formData, setFormData] = createSignal<TableFormData>({
    name: props.table?.name || '',
  });
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  const isEditing = () => !!props.table;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const data = formData();

    if (!data.name.trim()) {
      errors.name = 'Table name is required';
    } else if (data.name.trim().length < 2) {
      errors.name = 'Table name must be at least 2 characters';
    } else if (data.name.trim().length > 50) {
      errors.name = 'Table name must be less than 50 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const data = formData();
      
      if (isEditing() && props.table) {
        await table.updateTable(props.restaurantId, props.table.id, {
          name: data.name.trim(),
        });
      } else {
        await table.createTable(props.restaurantId, {
          name: data.name.trim(),
        });
      }
      
      props.onSuccess();
    } catch (error) {
      // Error is handled by the context
      console.error('Failed to save table:', error);
    }
  };

  const handleInputChange = (field: keyof TableFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors()[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">
        {isEditing() ? 'Edit Table' : 'Create New Table'}
      </h2>

      <Show when={table.error}>
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {table.error}
        </div>
      </Show>

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label for="table-name" class="block text-sm font-medium text-gray-700 mb-1">
            Table Name *
          </label>
          <input
            id="table-name"
            type="text"
            value={formData().name}
            onInput={(e) => handleInputChange('name', e.currentTarget.value)}
            placeholder="e.g., Table 1, VIP Room, Patio A"
            class={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationErrors().name 
                ? 'border-red-300 focus:border-red-500' 
                : 'border-gray-300 focus:border-blue-500'
            }`}
            disabled={table.isLoading}
          />
          <Show when={validationErrors().name}>
            <p class="mt-1 text-sm text-red-600">{validationErrors().name}</p>
          </Show>
          <p class="mt-1 text-sm text-gray-500">
            Give your table a descriptive name that staff and guests will recognize.
          </p>
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={props.onCancel}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={table.isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={table.isLoading}
          >
            {table.isLoading ? 'Saving...' : (isEditing() ? 'Update Table' : 'Create Table')}
          </button>
        </div>
      </form>

      <Show when={isEditing() && props.table}>
        <div class="mt-6 pt-6 border-t border-gray-200">
          <div class="text-sm text-gray-600">
            <p><strong>Table ID:</strong> {props.table?.id}</p>
            <p><strong>Unique Code:</strong> {props.table?.unique_code}</p>
            <p><strong>Created:</strong> {new Date(props.table?.created_at || '').toLocaleDateString()}</p>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default TableForm;