import { Route } from '@solidjs/router';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
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
      </Route>
    </>
  );
}

export default App;