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
  const [formError, setFormError] = createSignal<string | null>(null);

  const [formData, setFormData] = createSignal({
    name: props.section?.name || '',
    display_order: props.section?.display_order?.toString() || '',
  });

  const isEditing = () => !!props.section;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const data = formData();
    
    // Validation
    if (!data.name.trim()) {
      setFormError('Section name is required');
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEditing()) {
        const updateData: UpdateMenuSectionRequest = {
          name: data.name.trim(),
        };
        
        if (data.display_order) {
          const order = parseInt(data.display_order);
          if (isNaN(order) || order < 1) {
            setFormError('Display order must be a positive number');
            setIsSubmitting(false);
            return;
          }
          updateData.display_order = order;
        }

        await menu.updateSection(props.section!.id, updateData);
      } else {
        const createData: CreateMenuSectionRequest = {
          name: data.name.trim(),
        };
        
        if (data.display_order) {
          const order = parseInt(data.display_order);
          if (isNaN(order) || order < 1) {
            setFormError('Display order must be a positive number');
            setIsSubmitting(false);
            return;
          }
          createData.display_order = order;
        }

        await menu.createSection(props.restaurantId, createData);
      }

      props.onSuccess();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save section');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div class="bg-white p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-6">
        {isEditing() ? 'Edit Menu Section' : 'Create New Menu Section'}
      </h3>

      <Show when={formError()}>
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-red-800 text-sm">{formError()}</p>
        </div>
      </Show>

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
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
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
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
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