import '@testing-library/jest-dom'

// Mock the fetch API for testing
global.fetch = vi.fn()

// Mock environment variables
process.env.PUBLIC_API_BASE_URL = 'http://localhost:8080'
process.env.PUBLIC_API_VERSION = 'v1'

// Setup cleanup after each test
afterEach(() => {
  vi.restoreAllMocks()
})
