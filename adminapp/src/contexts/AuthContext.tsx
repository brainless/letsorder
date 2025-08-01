import { createContext, createSignal, createEffect, useContext, ParentComponent } from 'solid-js';
import { AuthService, TokenStorage } from '../services/auth';
import type { AuthState, User, LoginRequest, RegisterRequest } from '../types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [token, setToken] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const isAuthenticated = () => !!user() && !!token();

  // Initialize auth state from storage
  createEffect(() => {
    const storedToken = TokenStorage.getToken();
    const storedUser = TokenStorage.getUser();

    if (storedToken && storedUser) {
      if (TokenStorage.isTokenExpired(storedToken)) {
        TokenStorage.clear();
        setIsLoading(false);
        return;
      }

      // Validate token with backend
      AuthService.validateToken(storedToken)
        .then((valid) => {
          if (valid) {
            setToken(storedToken);
            setUser(storedUser);
            // Set up token expiration check
            setupTokenExpirationCheck(storedToken);
          } else {
            TokenStorage.clear();
          }
        })
        .catch(() => {
          TokenStorage.clear();
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  });

  // Set up token expiration monitoring
  const setupTokenExpirationCheck = (token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;

      // If token expires in less than 5 minutes, log out
      if (timeUntilExpiration <= 5 * 60 * 1000) {
        logout();
        return;
      }

      // Set timeout to logout 5 minutes before expiration
      setTimeout(() => {
        logout();
        setError('Your session has expired. Please log in again.');
      }, timeUntilExpiration - 5 * 60 * 1000);
    } catch (error) {
      console.error('Error parsing token:', error);
      logout();
    }
  };

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthService.login(credentials);
      
      setToken(response.token);
      setUser(response.user);
      
      TokenStorage.saveToken(response.token);
      TokenStorage.saveUser(response.user);
      
      // Set up token expiration monitoring
      setupTokenExpirationCheck(response.token);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthService.register(userData);
      
      setToken(response.token);
      setUser(response.user);
      
      TokenStorage.saveToken(response.token);
      TokenStorage.saveUser(response.user);
      
      // Set up token expiration monitoring
      setupTokenExpirationCheck(response.token);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setError(null);
    TokenStorage.clear();
  };

  const clearError = () => {
    setError(null);
  };

  const authValue = () => ({
    user: user(),
    token: token(),
    isAuthenticated: isAuthenticated(),
    isLoading: isLoading(),
    error: error(),
    login,
    register,
    logout,
    clearError,
  });

  return (
    <AuthContext.Provider value={authValue()}>
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.error('AuthContext is undefined. Make sure useAuth is called within an AuthProvider.');
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};