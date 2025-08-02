import { Component, createSignal, Show } from 'solid-js';
import { useMenu } from '../../contexts/MenuContext';
import type { MenuItem, CreateMenuItemRequest, UpdateMenuItemRequest } from '../../types/menu';

interface MenuItemFormProps {
  sectionId: string;
  item?: MenuItem;
  onSuccess: () => void;
  onCancel: () => void;
}

const MenuItemForm: Component<MenuItemFormProps> = (props) => {
  const menu = useMenu();
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  const [formData, setFormData] = createSignal({
    name: props.item?.name || '',
    description: props.item?.description || '',
    price: props.item?.price?.toString() || '',
    display_order: props.item?.display_order?.toString() || '',
  });

  const isEditing = () => !!props.item;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const data = formData();

    if (!data.name.trim()) {
      errors.name = 'Item name is required';
    }

    if (!data.price || isNaN(parseFloat(data.price)) || parseFloat(data.price) < 0) {
      errors.price = 'Valid price is required (must be 0 or greater)';
    }

    if (data.display_order) {
      const order = parseInt(data.display_order);
      if (isNaN(order) || order < 1) {
        errors.display_order = 'Display order must be a positive number';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const data = formData();
    const price = parseFloat(data.price);

    try {
      if (isEditing()) {
        const updateData: UpdateMenuItemRequest = {
          name: data.name.trim(),
          description: data.description.trim() || undefined,
          price,
          display_order: data.display_order ? parseInt(data.display_order) : undefined,
        };
        await menu.updateItem(props.item!.id, updateData);
      } else {
        const createData: CreateMenuItemRequest = {
          name: data.name.trim(),
          description: data.description.trim() || undefined,
          price,
          display_order: data.display_order ? parseInt(data.display_order) : undefined,
        };
        await menu.createItem(props.sectionId, createData);
      }

      props.onSuccess();
    } catch (err) {
      // Error is handled by the context and displayed on the dashboard
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (validationErrors()[key]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const formatPrice = (value: string) => {
    // Remove any non-digit, non-decimal characters
    const cleaned = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].slice(0, 2);
    }
    
    return cleaned;
  };

  const handlePriceInput = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const formatted = formatPrice(target.value);
    updateFormData('price', formatted);
  };

  return (
    <div class="bg-white p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-6">
        {isEditing() ? 'Edit Menu Item' : 'Create New Menu Item'}
      </h3>

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
            Item Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData().name}
            onInput={(e) => updateFormData('name', e.currentTarget.value)}
            placeholder="e.g., Caesar Salad, Grilled Salmon"
            class={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors().name ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          />
          <Show when={validationErrors().name}>
            <p class="mt-1 text-sm text-red-600">{validationErrors().name}</p>
          </Show>
        </div>

        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={formData().description}
            onInput={(e) => updateFormData('description', e.currentTarget.value)}
            placeholder="Describe the dish, ingredients, allergens, etc."
            rows="3"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="price" class="block text-sm font-medium text-gray-700 mb-2">
              Price ($) *
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                id="price"
                value={formData().price}
                onInput={handlePriceInput}
                placeholder="0.00"
                class={`block w-full pl-7 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors().price ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
            </div>
            <Show when={validationErrors().price}>
              <p class="mt-1 text-sm text-red-600">{validationErrors().price}</p>
            </Show>
          </div>

          <div>
            <label for="display_order" class="block text-sm font-medium text-gray-700 mb-2">
              Display Order
            </label>
            <input
              type="number"
              id="display_order"
              value={formData().display_order}
              onInput={(e) => updateFormData('display_order', e.currentTarget.value)}
              placeholder="Auto"
              min="1"
              class={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors().display_order ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <Show when={validationErrors().display_order}>
              <p class="mt-1 text-sm text-red-600">{validationErrors().display_order}</p>
            </Show>
          </div>
        </div>

        <div class="text-sm text-gray-500">
          <p class="mb-1">* Required fields</p>
          <p>Display order: Lower numbers appear first. Leave empty to add at the end.</p>
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={props.onCancel}
            disabled={isSubmitting()}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting()}
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Show when={isSubmitting()}>
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </Show>
            {isEditing() ? 'Update Item' : 'Create Item'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MenuItemForm;