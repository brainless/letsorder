import type { MenuData } from '../lib/api'

export const mockMenuData: MenuData = {
  restaurant: {
    name: "Test Restaurant",
    code: "test123",
    address: "123 Test Street, Test City"
  },
  table: {
    code: "table1",
    name: "Table 1"
  },
  sections: [
    {
      id: 1,
      name: "Appetizers",
      items: [
        {
          id: 1,
          name: "Caesar Salad",
          description: "Fresh romaine lettuce with parmesan and croutons",
          price: 12.99
        },
        {
          id: 2,
          name: "Garlic Bread",
          description: "Toasted bread with garlic butter",
          price: 8.99
        }
      ]
    },
    {
      id: 2,
      name: "Main Courses",
      items: [
        {
          id: 3,
          name: "Grilled Salmon",
          description: "Fresh Atlantic salmon with seasonal vegetables",
          price: 24.99
        },
        {
          id: 4,
          name: "Beef Steak",
          description: "Prime ribeye with mashed potatoes",
          price: 32.99
        }
      ]
    }
  ]
}

export const emptyMenuData: MenuData = {
  restaurant: {
    name: "Empty Restaurant",
    code: "empty123",
    address: "456 Empty Street, Empty City"
  },
  table: {
    code: "table2",
    name: "Table 2"
  },
  sections: []
}

export const mockFetchSuccess = (data: any) => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  })
}

export const mockFetchError = (status: number = 500, message: string = 'Internal Server Error') => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: message,
  })
}

export const mockFetchNetworkError = () => {
  (global.fetch as any).mockRejectedValueOnce(new Error('Network Error'))
}

// Helper to create DOM elements for testing
export const createTestElement = (html: string): HTMLElement => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.firstElementChild as HTMLElement
}

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper to simulate user input
export const simulateUserInput = (element: HTMLInputElement, value: string) => {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

// Helper to simulate key press
export const simulateKeyPress = (element: HTMLElement, key: string) => {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}
