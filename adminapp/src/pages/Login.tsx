import { createSignal, Show, createEffect } from 'solid-js';
import { Navigate } from '@solidjs/router';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [validationErrors, setValidationErrors] = createSignal<Record<string, string>>({});

  const auth = useAuth();

  // Clear auth errors when component mounts
  createEffect(() => {
    auth.clearError();
  });

  // Redirect if already authenticated (using Show for reactivity)
  if (auth.isAuthenticated) {
    return <Navigate href="/dashboard" />;
  }

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!email().trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password().trim()) {
      errors.password = 'Password is required';
    } else if (password().length < 6) {
      errors.password = 'Password must be at least 6 characters';
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
      await auth.login({
        email: email(),
        password: password(),
      });
      // Navigation will happen automatically via ProtectedRoute
    } catch (error) {
      // Error is handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to LetsOrder Admin
          </h2>
          <p class="mt-2 text-center text-sm text-gray-600">
            Manage your restaurant with ease
          </p>
        </div>
        <form class="mt-8 space-y-6" onSubmit={handleSubmit}>
          <Show when={auth.error}>
            <div class="rounded-md bg-red-50 p-4">
              <div class="text-sm text-red-700">{auth.error}</div>
            </div>
          </Show>

          <div class="rounded-md shadow-sm space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                class={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm ${
                  validationErrors().email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
                value={email()}
                onInput={(e) => {
                  setEmail(e.currentTarget.value);
                  if (validationErrors().email) {
                    setValidationErrors({ ...validationErrors(), email: '' });
                  }
                }}
              />
              <Show when={validationErrors().email}>
                <p class="mt-1 text-sm text-red-600">{validationErrors().email}</p>
              </Show>
            </div>
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                class={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm ${
                  validationErrors().password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
                value={password()}
                onInput={(e) => {
                  setPassword(e.currentTarget.value);
                  if (validationErrors().password) {
                    setValidationErrors({ ...validationErrors(), password: '' });
                  }
                }}
              />
              <Show when={validationErrors().password}>
                <p class="mt-1 text-sm text-red-600">{validationErrors().password}</p>
              </Show>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting()}
              class={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
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
              {isSubmitting() ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          
          <div class="text-center">
            <p class="text-sm text-gray-600">
              Don't have an account?{' '}
              <a href="/register" class="font-medium text-indigo-600 hover:text-indigo-500">
                Register here
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;