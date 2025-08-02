import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Header from '../Header';
import { createMockAuthProvider, createMockUIProvider } from '../../test/mocks/contexts';

// Mock the context imports
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => vi.fn(),
}));

vi.mock('../../contexts/UIContext', () => ({
  useUI: () => vi.fn(),
}));

describe('Header Component', () => {
  let MockAuthProvider: ReturnType<typeof createMockAuthProvider>;
  let MockUIProvider: ReturnType<typeof createMockUIProvider>;

  beforeEach(() => {
    MockAuthProvider = createMockAuthProvider();
    MockUIProvider = createMockUIProvider();
  });

  it('renders the application title', () => {
    render(() => (
      <MockAuthProvider>
        <MockUIProvider>
          <Header />
        </MockUIProvider>
      </MockAuthProvider>
    ));

    expect(screen.getByText('LetsOrder Admin')).toBeInTheDocument();
  });

  it('shows user menu when authenticated', () => {
    const authenticatedUser = { id: 1, email: 'test@example.com', role: 'manager' };
    MockAuthProvider = createMockAuthProvider(authenticatedUser);

    render(() => (
      <MockAuthProvider>
        <MockUIProvider>
          <Header />
        </MockUIProvider>
      </MockAuthProvider>
    ));

    expect(screen.getByText('T')).toBeInTheDocument(); // User initial
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('does not show user menu when not authenticated', () => {
    render(() => (
      <MockAuthProvider>
        <MockUIProvider>
          <Header />
        </MockUIProvider>
      </MockAuthProvider>
    ));

    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
  });

  it('displays correct user initials', () => {
    const authenticatedUser = { id: 1, email: 'john.doe@example.com', role: 'manager' };
    MockAuthProvider = createMockAuthProvider(authenticatedUser);

    render(() => (
      <MockAuthProvider>
        <MockUIProvider>
          <Header />
        </MockUIProvider>
      </MockAuthProvider>
    ));

    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('handles user with no email gracefully', () => {
    const authenticatedUser = { id: 1, email: '', role: 'manager' };
    MockAuthProvider = createMockAuthProvider(authenticatedUser);

    render(() => (
      <MockAuthProvider>
        <MockUIProvider>
          <Header />
        </MockUIProvider>
      </MockAuthProvider>
    ));

    expect(screen.getByText('U')).toBeInTheDocument(); // Default initial
    expect(screen.getByText('User')).toBeInTheDocument(); // Default display name
  });

  it('toggles user menu when clicked', async () => {
    const authenticatedUser = { id: 1, email: 'test@example.com', role: 'manager' };
    MockAuthProvider = createMockAuthProvider(authenticatedUser);

    render(() => (
      <MockAuthProvider>
        <MockUIProvider>
          <Header />
        </MockUIProvider>
      </MockAuthProvider>
    ));

    const userButton = screen.getByRole('button', { name: /open user menu/i });
    
    // Menu should not be visible initially
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
    
    // Click to open menu
    fireEvent.click(userButton);
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.getByText('Restaurant Manager')).toBeInTheDocument();
  });

  it('shows mobile sidebar toggle button', () => {
    render(() => (
      <MockAuthProvider>
        <MockUIProvider>
          <Header />
        </MockUIProvider>
      </MockAuthProvider>
    ));

    const sidebarButton = screen.getByRole('button', { name: /open sidebar/i });
    expect(sidebarButton).toBeInTheDocument();
  });
});