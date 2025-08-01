import { Route } from '@solidjs/router';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  return (
    <AuthProvider>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Layout}>
        <Route path={["", "/dashboard"]} component={() => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )} />
      </Route>
    </AuthProvider>
  );
}

export default App;