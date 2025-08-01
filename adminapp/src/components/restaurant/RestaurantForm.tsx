import { createSignal, Show, createEffect } from 'solid-js';
import { useRestaurant } from '../../contexts/RestaurantContext';
import type { Restaurant, CreateRestaurantRequest } from '../../types/restaurant';

interface RestaurantFormProps {
  restaurant?: Restaurant | null;
  onSuccess: (restaurant: Restaurant) => void;
  onCancel: () => void;
}

function RestaurantForm(props: RestaurantFormProps) {
  const restaurant = useRestaurant();
  
  // Form fields
  const [name, setName] = createSignal('');
  const [address, setAddress] = createSignal('');
  const [establishmentYear, setEstablishmentYear] = createSignal<number | undefined>(undefined);
  const [googleMapsLink, setGoogleMapsLink] = createSignal('');
  
  // Form state
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  const isEditing = () => !!props.restaurant;

  // Initialize form with existing restaurant data if editing
  createEffect(() => {
    if (props.restaurant) {
      setName(props.restaurant.name);
      setAddress(props.restaurant.address || '');
      setEstablishmentYear(props.restaurant.establishment_year);
      setGoogleMapsLink(props.restaurant.google_maps_link || '');
    } else {
      // Reset form for create mode
      setName('');
      setAddress('');
      setEstablishmentYear(undefined);
      setGoogleMapsLink('');
    }
    setValidationErrors({});
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!name().trim()) {
      errors.name = 'Restaurant name is required';
    }
    
    if (establishmentYear() !== undefined) {
      const currentYear = new Date().getFullYear();
      if (establishmentYear()! < 1800 || establishmentYear()! > currentYear) {
        errors.establishment_year = `Year must be between 1800 and ${currentYear}`;
      }
    }
    
    if (googleMapsLink().trim() && !isValidUrl(googleMapsLink())) {
      errors.google_maps_link = 'Please enter a valid URL';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData: CreateRestaurantRequest = {
        name: name().trim(),
        address: address().trim() || undefined,
        establishment_year: establishmentYear(),
        google_maps_link: googleMapsLink().trim() || undefined,
      };

      let result: Restaurant;
      if (isEditing() && props.restaurant) {
        result = await restaurant.updateRestaurant(props.restaurant.id, formData);
      } else {
        result = await restaurant.createRestaurant(formData);
      }
      
      props.onSuccess(result);
    } catch (error) {
      // Error is handled by context
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
    <div class="px-4 py-5 sm:p-6">
      <form onSubmit={handleSubmit} class="space-y-6">
        {/* Restaurant Name */}
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700">
            Restaurant Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            class={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
              validationErrors().name ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter restaurant name"
            value={name()}
            onInput={(e) => {
              setName(e.currentTarget.value);
              clearFieldError('name');
            }}
          />
          <Show when={validationErrors().name}>
            <p class="mt-1 text-sm text-red-600">{validationErrors().name}</p>
          </Show>
        </div>

        {/* Address */}
        <div>
          <label for="address" class="block text-sm font-medium text-gray-700">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            rows={3}
            class={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
              validationErrors().address ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter restaurant address"
            value={address()}
            onInput={(e) => {
              setAddress(e.currentTarget.value);
              clearFieldError('address');
            }}
          />
          <Show when={validationErrors().address}>
            <p class="mt-1 text-sm text-red-600">{validationErrors().address}</p>
          </Show>
        </div>

        {/* Establishment Year */}
        <div>
          <label for="establishment_year" class="block text-sm font-medium text-gray-700">
            Establishment Year
          </label>
          <input
            id="establishment_year"
            name="establishment_year"
            type="number"
            min="1800"
            max={new Date().getFullYear()}
            class={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
              validationErrors().establishment_year ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="e.g. 2020"
            value={establishmentYear()?.toString() || ''}
            onInput={(e) => {
              const value = e.currentTarget.value;
              setEstablishmentYear(value ? parseInt(value) : undefined);
              clearFieldError('establishment_year');
            }}
          />
          <Show when={validationErrors().establishment_year}>
            <p class="mt-1 text-sm text-red-600">{validationErrors().establishment_year}</p>
          </Show>
        </div>

        {/* Google Maps Link */}
        <div>
          <label for="google_maps_link" class="block text-sm font-medium text-gray-700">
            Google Maps Link
          </label>
          <input
            id="google_maps_link"
            name="google_maps_link"
            type="url"
            class={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
              validationErrors().google_maps_link ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="https://maps.google.com/..."
            value={googleMapsLink()}
            onInput={(e) => {
              setGoogleMapsLink(e.currentTarget.value);
              clearFieldError('google_maps_link');
            }}
          />
          <Show when={validationErrors().google_maps_link}>
            <p class="mt-1 text-sm text-red-600">{validationErrors().google_maps_link}</p>
          </Show>
          <p class="mt-1 text-sm text-gray-500">
            Optional: Link to your restaurant's location on Google Maps
          </p>
        </div>

        {/* Form Actions */}
        <div class="flex justify-end space-x-3">
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
            {isSubmitting() 
              ? (isEditing() ? 'Updating...' : 'Creating...') 
              : (isEditing() ? 'Update Restaurant' : 'Create Restaurant')
            }
          </button>
        </div>
      </form>
    </div>
  );
}

export default RestaurantForm;