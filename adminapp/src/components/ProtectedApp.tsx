import { Route } from '@solidjs/router';
import ProtectedRoute from './ProtectedRoute';
import Layout from './Layout';
import Dashboard from '../pages/Dashboard';

function ProtectedApp() {
  return (
    <ProtectedRoute>
      <Route path="/" component={Layout}>
        <Route path={["", "/dashboard"]} component={Dashboard} />
      </Route>
    </ProtectedRoute>
  );
}

export default ProtectedApp;