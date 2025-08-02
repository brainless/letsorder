import { Component, createSignal, Show } from 'solid-js';
import { useMenu } from '../../contexts/MenuContext';
import type { MenuSection, CreateMenuSectionRequest, UpdateMenuSectionRequest } from '../../types/menu';

interface MenuSectionFormProps {
  restaurantId: string;
  section?: MenuSection;
  onSuccess: () => void;
  onCancel: () => void;
}

const MenuSectionForm: Component<MenuSectionFormProps> = (props) => {
  const menu = useMenu();
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  const [formData, setFormData] = createSignal({
    name: props.section?.name || '',
    display_order: props.section?.display_order?.toString() || '',
  });

  const isEditing = () => !!props.section;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const data = formData();

    if (!data.name.trim()) {
      errors.name = 'Section name is required';
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

    try {
      if (isEditing()) {
        const updateData: UpdateMenuSectionRequest = {
          name: data.name.trim(),
          display_order: data.display_order ? parseInt(data.display_order) : undefined,
        };
        await menu.updateSection(props.section!.id, updateData);
      } else {
        const createData: CreateMenuSectionRequest = {
          name: data.name.trim(),
          display_order: data.display_order ? parseInt(data.display_order) : undefined,
        };
        await menu.createSection(props.restaurantId, createData);
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

  return (
    <div class="bg-white p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-6">
        {isEditing() ? 'Edit Menu Section' : 'Create New Menu Section'}
      </h3>

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
            Section Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData().name}
            onInput={(e) => updateFormData('name', e.currentTarget.value)}
            placeholder="e.g., Appetizers, Main Course, Desserts"
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
          <label for="display_order" class="block text-sm font-medium text-gray-700 mb-2">
            Display Order
          </label>
          <input
            type="number"
            id="display_order"
            value={formData().display_order}
            onInput={(e) => updateFormData('display_order', e.currentTarget.value)}
            placeholder="Leave empty for automatic ordering"
            min="1"
            class={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors().display_order ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <Show when={validationErrors().display_order}>
            <p class="mt-1 text-sm text-red-600">{validationErrors().display_order}</p>
          </Show>
          <p class="mt-1 text-sm text-gray-500">
            Optional. Lower numbers appear first. Leave empty to add at the end.
          </p>
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
            {isEditing() ? 'Update Section' : 'Create Section'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MenuSectionForm;