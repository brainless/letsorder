import { Route } from '@solidjs/router';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import RestaurantDashboard from './pages/RestaurantDashboard';
import TableDashboard from './pages/TableDashboard';
import MenuDashboard from './pages/MenuDashboard';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  return (
    <>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Layout}>
        <Route path={["", "/dashboard"]} component={() => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )} />
        <Route path="/restaurants" component={() => (
          <ProtectedRoute>
            <RestaurantDashboard />
          </ProtectedRoute>
        )} />
        <Route path="/restaurants/:restaurantId/tables" component={() => (
          <ProtectedRoute>
            <TableDashboard />
          </ProtectedRoute>
        )} />
        <Route path="/restaurants/:restaurantId/menu" component={() => (
          <ProtectedRoute>
            <MenuDashboard />
          </ProtectedRoute>
        )} />
      </Route>
    </>
  );
}

export default App;