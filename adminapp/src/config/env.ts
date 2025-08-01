export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  appUrl: import.meta.env.VITE_APP_URL || 'http://localhost:3000',
  nodeEnv: import.meta.env.VITE_NODE_ENV || 'development',
};