import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { createSignal } from 'solid-js';

// Mock the auth service
vi.mock('../../services/auth', () => ({
  AuthService: {
    login: vi.fn(),
    register: vi.fn(),
    validateToken: vi.fn(),
  },
  TokenStorage: {
    getToken: vi.fn(),
    getUser: vi.fn(),
    saveToken: vi.fn(),
    saveUser: vi.fn(),
    removeToken: vi.fn(),
    removeUser: vi.fn(),
    clear: vi.fn(),
    isTokenExpired: vi.fn(),
  },
}));

import { AuthService, TokenStorage } from '../../services/auth';

// Test component to interact with auth context
function TestComponent() {
  const auth = useAuth();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');

  const handleLogin = async () => {
    try {
      await auth.login({
        email: email(),
        password: password(),
      });
    } catch (error) {
      // Error will be in auth.error
    }
  };

  return (
    <div>
      <div data-testid="auth-status">
        {auth.isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="loading-status">
        {auth.isLoading ? 'loading' : 'not-loading'}
      </div>
      <div data-testid="user-email">
        {auth.user?.email || 'no-user'}
      </div>
      <div data-testid="error-message">
        {auth.error || 'no-error'}
      </div>
      
      <input
        data-testid="email-input"
        value={email()}
        onInput={(e) => setEmail(e.currentTarget.value)}
      />
      <input
        data-testid="password-input"
        type="password"
        value={password()}
        onInput={(e) => setPassword(e.currentTarget.value)}
      />
      <button data-testid="login-button" onClick={handleLogin}>
        Login
      </button>
      <button data-testid="logout-button" onClick={auth.logout}>
        Logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    (TokenStorage.getToken as any).mockReturnValue(null);
    (TokenStorage.getUser as any).mockReturnValue(null);
    (TokenStorage.isTokenExpired as any).mockReturnValue(false);
    (AuthService.validateToken as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with unauthenticated state', async () => {
    render(() => (
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
    });
  });

  it('should restore authentication from storage', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    const mockToken = 'valid-token';

    (TokenStorage.getToken as any).mockReturnValue(mockToken);
    (TokenStorage.getUser as any).mockReturnValue(mockUser);
    (TokenStorage.isTokenExpired as any).mockReturnValue(false);
    (AuthService.validateToken as any).mockResolvedValue(true);

    render(() => (
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    expect(AuthService.validateToken).toHaveBeenCalledWith(mockToken);
  });

  it('should clear storage if token is expired', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    const mockToken = 'expired-token';

    (TokenStorage.getToken as any).mockReturnValue(mockToken);
    (TokenStorage.getUser as any).mockReturnValue(mockUser);
    (TokenStorage.isTokenExpired as any).mockReturnValue(true);

    render(() => (
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    expect(TokenStorage.clear).toHaveBeenCalled();
    expect(AuthService.validateToken).not.toHaveBeenCalled();
  });

  it('should handle successful login', async () => {
    const mockResponse = {
      token: 'new-token',
      user: { id: 1, email: 'test@example.com' },
    };

    (AuthService.login as any).mockResolvedValue(mockResponse);

    render(() => (
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    ));

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    // Fill in login form
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    expect(AuthService.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(TokenStorage.saveToken).toHaveBeenCalledWith('new-token');
    expect(TokenStorage.saveUser).toHaveBeenCalledWith(mockResponse.user);
  });

  it('should handle login error', async () => {
    const mockError = new Error('Invalid credentials');
    (AuthService.login as any).mockRejectedValue(mockError);

    render(() => (
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    ));

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('not-loading');
    });

    // Fill in login form with invalid credentials
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid credentials');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });
  });

  it('should handle logout', async () => {
    // Start with authenticated user
    const mockUser = { id: 1, email: 'test@example.com' };
    const mockToken = 'valid-token';

    (TokenStorage.getToken as any).mockReturnValue(mockToken);
    (TokenStorage.getUser as any).mockReturnValue(mockUser);
    (AuthService.validateToken as any).mockResolvedValue(true);

    render(() => (
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    ));

    // Wait for authentication to be restored
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    // Logout
    const logoutButton = screen.getByTestId('logout-button');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
    });

    expect(TokenStorage.clear).toHaveBeenCalled();
  });

  it('should throw error when useAuth is used outside provider', () => {
    expect(() => {
      render(() => <TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});