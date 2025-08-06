import { describe, it, expect, beforeEach } from 'vitest'
import { fetchMenu, createOrder } from './api'
import { mockMenuData, mockFetchSuccess, mockFetchError, mockFetchNetworkError } from '../test/utils'

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchMenu', () => {
    it('should fetch menu data successfully', async () => {
      mockFetchSuccess(mockMenuData)

      const result = await fetchMenu('test123', 'table1')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/menu/test123/table1'
      )
      expect(result).toEqual(mockMenuData)
    })

    it('should handle API error responses', async () => {
      mockFetchError(404, 'Not Found')

      await expect(fetchMenu('invalid', 'invalid')).rejects.toThrow(
        'Failed to fetch menu: 404'
      )
    })

    it('should handle network errors', async () => {
      mockFetchNetworkError()

      await expect(fetchMenu('test123', 'table1')).rejects.toThrow(
        'Network Error'
      )
    })

    it('should use correct API URL format', async () => {
      mockFetchSuccess(mockMenuData)

      await fetchMenu('restaurant123', 'table456')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/menu/restaurant123/table456'
      )
    })
  })

  describe('createOrder', () => {
    const orderData = {
      restaurant_code: 'test123',
      table_code: 'table1',
      items: [
        { menu_item_id: 1, quantity: 2 },
        { menu_item_id: 3, quantity: 1 }
      ],
      customer_name: 'John Doe',
      customer_phone: '+1234567890'
    }

    const orderResponse = { order_id: 'order123' }

    it('should create order successfully', async () => {
      mockFetchSuccess(orderResponse)

      const result = await createOrder(orderData)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/orders',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData),
        }
      )
      expect(result).toEqual(orderResponse)
    })

    it('should handle order creation errors', async () => {
      mockFetchError(400, 'Bad Request')

      await expect(createOrder(orderData)).rejects.toThrow(
        'Failed to create order: 400'
      )
    })

    it('should handle network errors during order creation', async () => {
      mockFetchNetworkError()

      await expect(createOrder(orderData)).rejects.toThrow(
        'Network Error'
      )
    })
  })
})
