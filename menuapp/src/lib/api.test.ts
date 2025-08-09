import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getOrder } from './api'

// Mock fetch globally
global.fetch = vi.fn()

// Mock AbortSignal.timeout
if (!AbortSignal.timeout) {
  AbortSignal.timeout = vi.fn(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    aborted: false,
    reason: undefined
  }))
}

describe('Order API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrder', () => {
    it('should fetch order details successfully', async () => {
      const mockOrderData = {
        id: 'order-123',
        table_id: 'table-456',
        table_name: 'Table 1',
        restaurant_name: 'Test Restaurant',
        items: [
          {
            menu_item_id: 'item-1',
            menu_item_name: 'Test Item',
            quantity: 2,
            price: 10.99,
            special_requests: null
          }
        ],
        total_amount: 21.98,
        status: 'pending',
        customer_name: 'John Doe',
        created_at: '2024-01-01T12:00:00Z'
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrderData
      })

      const result = await getOrder('order-123')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/orders/order-123',
        expect.objectContaining({
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          signal: expect.any(Object)
        })
      )
      expect(result).toEqual(mockOrderData)
    })

    it('should handle order not found (404)', async () => {
      // Mock all retry attempts to fail with 404
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404
      })

      await expect(getOrder('invalid-order')).rejects.toThrow('Order not found')
    })

    it('should handle other API errors', async () => {
      // Mock all retry attempts to fail with 500
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(getOrder('order-123')).rejects.toThrow('Server error: 500')
    })

    it('should handle network errors', async () => {
      // Mock all retry attempts to fail with network error
      ;(global.fetch as any).mockRejectedValue(new Error('Network Error'))

      await expect(getOrder('order-123')).rejects.toThrow('Network Error')
    })
  })
})