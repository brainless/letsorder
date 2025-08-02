import { createContext, useContext, JSX } from 'solid-js';
import { createStore } from 'solid-js/store';

// Mock Auth Context
export interface MockAuthUser {
  id: number;
  email: string;
  role: string;
}

export interface MockAuthContextType {
  user: MockAuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const MockAuthContext = createContext<MockAuthContextType>();

export function createMockAuthProvider(initialUser: MockAuthUser | null = null) {
  return function MockAuthProvider(props: { children: JSX.Element }) {
    const [store, setStore] = createStore({
      user: initialUser,
      isAuthenticated: !!initialUser,
      loading: false,
    });

    const logout = () => {
      setStore({ user: null, isAuthenticated: false });
    };

    const login = async (email: string, password: string) => {
      setStore({ loading: true });
      // Mock login logic
      const mockUser = { id: 1, email, role: 'manager' };
      setStore({ user: mockUser, isAuthenticated: true, loading: false });
    };

    const value: MockAuthContextType = {
      get user() { return store.user; },
      get isAuthenticated() { return store.isAuthenticated; },
      get loading() { return store.loading; },
      login,
      logout,
    };

    return (
      <MockAuthContext.Provider value={value}>
        {props.children}
      </MockAuthContext.Provider>
    );
  };
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useMockAuth must be used within MockAuthProvider');
  }
  return context;
}

// Mock UI Context
export interface MockUIContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const MockUIContext = createContext<MockUIContextType>();

export function createMockUIProvider() {
  return function MockUIProvider(props: { children: JSX.Element }) {
    const [store, setStore] = createStore({
      sidebarOpen: false,
    });

    const toggleSidebar = () => {
      setStore({ sidebarOpen: !store.sidebarOpen });
    };

    const closeSidebar = () => {
      setStore({ sidebarOpen: false });
    };

    const value: MockUIContextType = {
      get sidebarOpen() { return store.sidebarOpen; },
      toggleSidebar,
      closeSidebar,
    };

    return (
      <MockUIContext.Provider value={value}>
        {props.children}
      </MockUIContext.Provider>
    );
  };
}

export function useMockUI() {
  const context = useContext(MockUIContext);
  if (!context) {
    throw new Error('useMockUI must be used within MockUIProvider');
  }
  return context;
}