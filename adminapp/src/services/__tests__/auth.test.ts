import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService, TokenStorage } from '../auth';

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        token: 'mock-jwt-token',
        user: { id: 1, email: 'test@example.com' },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await AuthService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed login', async () => {
      const mockError = { error: 'Invalid credentials' };

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockError,
      });

      await expect(
        AuthService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle network errors gracefully', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        AuthService.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const result = await AuthService.validateToken('valid-token');
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const result = await AuthService.validateToken('invalid-token');
      expect(result).toBe(false);
    });

    it('should return true on network error to avoid unnecessary logouts', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await AuthService.validateToken('token');
      expect(result).toBe(true);
    });
  });
});

describe('TokenStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('token management', () => {
    it('should save and retrieve token', () => {
      const token = 'test-token';
      
      TokenStorage.saveToken(token);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('letsorder_token', token);
      
      const retrievedToken = TokenStorage.getToken();
      expect(localStorageMock.getItem).toHaveBeenCalledWith('letsorder_token');
    });

    it('should remove token', () => {
      TokenStorage.removeToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('letsorder_token');
    });
  });

  describe('user management', () => {
    it('should save and retrieve user data', () => {
      const user = { id: 1, email: 'test@example.com' };
      
      TokenStorage.saveUser(user);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'letsorder_user',
        JSON.stringify(user)
      );
    });

    it('should handle invalid JSON when retrieving user', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid-json');
      
      expect(() => TokenStorage.getUser()).toThrow();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid unexpired token', () => {
      // Create a token that expires in the future
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp: futureTime };
      const token = 'header.' + btoa(JSON.stringify(payload)) + '.signature';
      
      expect(TokenStorage.isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      // Create a token that expired in the past
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = { exp: pastTime };
      const token = 'header.' + btoa(JSON.stringify(payload)) + '.signature';
      
      expect(TokenStorage.isTokenExpired(token)).toBe(true);
    });

    it('should return true for invalid token format', () => {
      expect(TokenStorage.isTokenExpired('invalid-token')).toBe(true);
    });

    it('should return true for malformed JWT payload', () => {
      const token = 'header.invalid-base64.signature';
      expect(TokenStorage.isTokenExpired(token)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove both token and user data', () => {
      TokenStorage.clear();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('letsorder_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('letsorder_user');
    });
  });
});