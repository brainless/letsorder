import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the context modules before importing Header
const mockAuth = {
  user: null as any,
  isAuthenticated: false,
  logout: vi.fn(),
  loading: false,
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  clearError: vi.fn(),
  token: null,
};

const mockUI = {
  sidebarOpen: false,
  toggleSidebar: vi.fn(),
  closeSidebar: vi.fn(),
};

const mockRestaurant = {
  restaurants: [],
  currentRestaurant: null,
  managers: [],
  isLoading: false,
  error: null,
  loadUserRestaurants: vi.fn(),
  createRestaurant: vi.fn(),
  updateRestaurant: vi.fn(),
  deleteRestaurant: vi.fn(),
  loadRestaurantManagers: vi.fn(),
  inviteManager: vi.fn(),
  updateManagerPermissions: vi.fn(),
  removeManager: vi.fn(),
  setCurrentRestaurant: vi.fn(),
  clearError: vi.fn(),
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../../contexts/UIContext', () => ({
  useUI: () => mockUI,
}));

vi.mock('../../contexts/RestaurantContext', () => ({
  useRestaurant: () => mockRestaurant,
}));

// Now import Header after mocking
import Header from '../Header';

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock values
    mockAuth.user = null;
    mockAuth.isAuthenticated = false;
    mockUI.sidebarOpen = false;
    mockRestaurant.restaurants = [];
    mockRestaurant.currentRestaurant = null;
  });

  it('renders the application title', () => {
    render(() => <Header />);
    expect(screen.getByText('LetsOrder Admin')).toBeInTheDocument();
  });

  it('shows user menu when authenticated', () => {
    mockAuth.user = { id: 1, email: 'test@example.com', role: 'manager' };
    mockAuth.isAuthenticated = true;

    render(() => <Header />);

    expect(screen.getByText('T')).toBeInTheDocument(); // User initial
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('does not show user menu when not authenticated', () => {
    mockAuth.user = null;
    mockAuth.isAuthenticated = false;

    render(() => <Header />);

    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
  });

  it('displays correct user initials', () => {
    mockAuth.user = { id: 1, email: 'john.doe@example.com', role: 'manager' };
    mockAuth.isAuthenticated = true;

    render(() => <Header />);

    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('handles user with no email gracefully', () => {
    mockAuth.user = { id: 1, email: '', role: 'manager' };
    mockAuth.isAuthenticated = true;

    render(() => <Header />);

    expect(screen.getByText('U')).toBeInTheDocument(); // Default initial
    expect(screen.getByText('User')).toBeInTheDocument(); // Default display name
  });

  it('toggles user menu when clicked', async () => {
    mockAuth.user = { id: 1, email: 'test@example.com', role: 'manager' };
    mockAuth.isAuthenticated = true;

    render(() => <Header />);

    const userButton = screen.getByRole('button', { name: /open user menu/i });
    
    // Menu should not be visible initially
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
    
    // Click to open menu
    fireEvent.click(userButton);
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.getByText('Restaurant Manager')).toBeInTheDocument();
  });

  it('shows mobile sidebar toggle button', () => {
    render(() => <Header />);

    const sidebarButton = screen.getByRole('button', { name: /open sidebar/i });
    expect(sidebarButton).toBeInTheDocument();
  });

  it('calls logout function when sign out is clicked', () => {
    mockAuth.user = { id: 1, email: 'test@example.com', role: 'manager' };
    mockAuth.isAuthenticated = true;

    render(() => <Header />);

    const userButton = screen.getByRole('button', { name: /open user menu/i });
    fireEvent.click(userButton);

    const signOutButton = screen.getByText('Sign out');
    fireEvent.click(signOutButton);

    expect(mockAuth.logout).toHaveBeenCalled();
  });

  it('calls toggle sidebar when mobile menu button is clicked', () => {
    render(() => <Header />);

    const sidebarButton = screen.getByRole('button', { name: /open sidebar/i });
    fireEvent.click(sidebarButton);

    expect(mockUI.toggleSidebar).toHaveBeenCalled();
  });
});