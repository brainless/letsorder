import { createSignal, Show } from 'solid-js';
import { useRestaurant } from '../../contexts/RestaurantContext';

interface ManagerInviteFormProps {
  restaurantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function ManagerInviteForm(props: ManagerInviteFormProps) {
  const restaurant = useRestaurant();
  
  const [email, setEmail] = createSignal('');
  const [canManageMenu, setCanManageMenu] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!email().trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) {
      errors.email = 'Please enter a valid email address';
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
    
    try {
      await restaurant.inviteManager(props.restaurantId, {
        email: email().trim(),
        role: 'manager',
        can_manage_menu: canManageMenu(),
      });
      
      // Reset form
      setEmail('');
      setCanManageMenu(false);
      setValidationErrors({});
      
      props.onSuccess();
    } catch (error) {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFieldError = (field: string) => {
    if (validationErrors()[field]) {
      setValidationErrors({ ...validationErrors(), [field]: '' });
    }
  };

  return (
    <div>
      <h4 class="text-lg font-medium text-gray-900 mb-4">Invite New Manager</h4>
      
      <form onSubmit={handleSubmit} class="space-y-4">
        {/* Email */}
        <div>
          <label for="invite-email" class="block text-sm font-medium text-gray-700">
            Email Address *
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            class={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
              validationErrors().email ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="manager@example.com"
            value={email()}
            onInput={(e) => {
              setEmail(e.currentTarget.value);
              clearFieldError('email');
            }}
          />
          <Show when={validationErrors().email}>
            <p class="mt-1 text-sm text-red-600">{validationErrors().email}</p>
          </Show>
        </div>

        {/* Permissions */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Permissions
          </label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input
                type="checkbox"
                checked={canManageMenu()}
                onChange={(e) => setCanManageMenu(e.currentTarget.checked)}
                class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span class="ml-2 text-sm text-gray-700">
                Can manage menu items
              </span>
            </label>
          </div>
          <p class="mt-1 text-xs text-gray-500">
            Select the permissions this manager should have for the restaurant.
          </p>
        </div>

        {/* Form Actions */}
        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={props.onCancel}
            disabled={isSubmitting()}
            class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting()}
            class={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              isSubmitting()
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <Show when={isSubmitting()}>
              <div class="animate-spin -ml-1 mr-3 h-5 w-5 text-white">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </Show>
            {isSubmitting() ? 'Sending Invite...' : 'Send Invitation'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ManagerInviteForm;