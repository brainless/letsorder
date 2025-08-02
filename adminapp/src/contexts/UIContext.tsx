import { createContext, useContext, createSignal, Accessor } from 'solid-js';
import type { ParentComponent } from 'solid-js';

interface UIContextType {
  isSidebarOpen: Accessor<boolean>;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
}

const UIContext = createContext<UIContextType>();

export const UIProvider: ParentComponent = (props) => {
  const [isSidebarOpen, setSidebarOpen] = createSignal(false);

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen());
  };

  const value = {
    isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
  };

  return (
    <UIContext.Provider value={value}>{props.children}</UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
