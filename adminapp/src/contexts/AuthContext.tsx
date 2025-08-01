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

  const isAuthenticated = () => {
    const authState = !!user() && !!token();
    console.log('isAuthenticated check:', { user: user(), token: token(), isAuth: authState });
    return authState;
  };

  // Initialize auth state from storage
  createEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = TokenStorage.getToken();
        const storedUser = TokenStorage.getUser();

        console.log('Initializing auth with stored data:', { 
          hasToken: !!storedToken, 
          hasUser: !!storedUser 
        });

        if (storedToken && storedUser) {
          // Check if token is expired before making API call
          if (TokenStorage.isTokenExpired(storedToken)) {
            console.log('Stored token is expired, clearing storage');
            TokenStorage.clear();
            setIsLoading(false);
            return;
          }

          console.log('Validating stored token with backend');
          // Validate token with backend
          const valid = await AuthService.validateToken(storedToken);
          
          if (valid) {
            console.log('Token validation successful, restoring session');
            setToken(storedToken);
            setUser(storedUser);
            // Set up token expiration check
            setupTokenExpirationCheck(storedToken);
          } else {
            console.log('Token validation failed, clearing storage');
            TokenStorage.clear();
          }
        } else {
          console.log('No stored auth data found');
        }
      } catch (error) {
        console.error('Error during auth initialization:', error);
        TokenStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  });

  // Set up token expiration monitoring
  const setupTokenExpirationCheck = (token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;

      console.log('Setting up token expiration check:', {
        expirationTime,
        currentTime,
        timeUntilExpiration,
        timeUntilExpirationHours: Math.floor(timeUntilExpiration / (1000 * 60 * 60))
      });

      // If token expires in less than 5 minutes, log out immediately
      if (timeUntilExpiration <= 5 * 60 * 1000) {
        console.log('Token expires soon, logging out immediately');
        logout();
        return;
      }

      // Set timeout to logout 5 minutes before expiration
      const logoutTime = Math.max(timeUntilExpiration - 5 * 60 * 1000, 0);
      setTimeout(() => {
        console.log('Token expiration timeout reached, logging out');
        logout();
        setError('Your session has expired. Please log in again.');
      }, logoutTime);
    } catch (error) {
      console.error('Error parsing token for expiration check:', error);
      logout();
    }
  };

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthService.login(credentials);
      console.log('Login response:', response);
      
      setToken(response.token);
      setUser(response.user);
      
      TokenStorage.saveToken(response.token);
      TokenStorage.saveUser(response.user);
      
      console.log('Auth state after login:', { user: response.user, token: response.token });
      
      // Set up token expiration monitoring
      setupTokenExpirationCheck(response.token);
    } catch (err) {
      console.error('Login error:', err);
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

  const contextValue: AuthContextType = {
    get user() { return user(); },
    get token() { return token(); },
    get isAuthenticated() { return isAuthenticated(); },
    get isLoading() { return isLoading(); },
    get error() { return error(); },
    login,
    register,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};