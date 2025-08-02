/* @refresh reload */
import { render } from 'solid-js/web';
import { Router } from '@solidjs/router';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { RestaurantProvider } from './contexts/RestaurantContext';
import { TableProvider } from './contexts/TableContext';
import { OrderProvider } from './contexts/OrderContext';
import App from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

render(() => (
  <AuthProvider>
    <UIProvider>
      <RestaurantProvider>
        <TableProvider>
          <OrderProvider>
            <Router>
              <App />
            </Router>
          </OrderProvider>
        </TableProvider>
      </RestaurantProvider>
    </UIProvider>
  </AuthProvider>
), root!);