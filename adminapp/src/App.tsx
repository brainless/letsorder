import { Route, Router } from '@solidjs/router';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  return (
    <Route path="/" component={Layout}>
      <Route path="/login" component={Login} />
      <Route path={["", "/dashboard"]} component={Dashboard} />
    </Route>
  );
}

export default App;