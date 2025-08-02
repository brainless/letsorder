import { Show, ParentComponent } from 'solid-js';
import { Navigate } from '@solidjs/router';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  fallback?: string;
}

const ProtectedRoute: ParentComponent<ProtectedRouteProps> = (props) => {
  const auth = useAuth();

  return (
    <Show
      when={!auth.isLoading}
      fallback={
        <div class="min-h-screen flex items-center justify-center">
          <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      }
    >
      <Show
        when={auth.isAuthenticated}
        fallback={<Navigate href={props.fallback || '/login'} />}
      >
        {props.children}
      </Show>
    </Show>
  );
};

export default ProtectedRoute;
