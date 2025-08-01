import { Route } from '@solidjs/router';
import { lazy } from 'solid-js';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';

const ProtectedApp = lazy(() => import('./components/ProtectedApp'));

function App() {
  return (
    <AuthProvider>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/*" component={ProtectedApp} />
    </AuthProvider>
  );
}

export default App;