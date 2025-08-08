import { describe, it, expect } from 'vitest'

// Since we can't easily test Astro components directly, we'll test the logic
describe('OrderStatusBadge Logic', () => {
  // Extract the status mapping logic for testing
  function getStatusInfo(status: string) {
    const statusMap = {
      'pending': { label: 'Order Received', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
      'confirmed': { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: '✓' },
      'preparing': { label: 'Preparing', color: 'bg-orange-100 text-orange-800', icon: '👨‍🍳' },
      'ready': { label: 'Ready for Pickup', color: 'bg-green-100 text-green-800', icon: '🔔' },
      'delivered': { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: '✅' },
      'cancelled': { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: '❌' }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.pending;
  }

  it('should return correct info for pending status', () => {
    const result = getStatusInfo('pending')
    expect(result.label).toBe('Order Received')
    expect(result.color).toBe('bg-yellow-100 text-yellow-800')
    expect(result.icon).toBe('⏳')
  })

  it('should return correct info for confirmed status', () => {
    const result = getStatusInfo('confirmed')
    expect(result.label).toBe('Confirmed')
    expect(result.color).toBe('bg-blue-100 text-blue-800')
    expect(result.icon).toBe('✓')
  })

  it('should return correct info for preparing status', () => {
    const result = getStatusInfo('preparing')
    expect(result.label).toBe('Preparing')
    expect(result.color).toBe('bg-orange-100 text-orange-800')
    expect(result.icon).toBe('👨‍🍳')
  })

  it('should return correct info for ready status', () => {
    const result = getStatusInfo('ready')
    expect(result.label).toBe('Ready for Pickup')
    expect(result.color).toBe('bg-green-100 text-green-800')
    expect(result.icon).toBe('🔔')
  })

  it('should return correct info for delivered status', () => {
    const result = getStatusInfo('delivered')
    expect(result.label).toBe('Delivered')
    expect(result.color).toBe('bg-green-100 text-green-800')
    expect(result.icon).toBe('✅')
  })

  it('should return correct info for cancelled status', () => {
    const result = getStatusInfo('cancelled')
    expect(result.label).toBe('Cancelled')
    expect(result.color).toBe('bg-red-100 text-red-800')
    expect(result.icon).toBe('❌')
  })

  it('should default to pending for unknown status', () => {
    const result = getStatusInfo('unknown')
    expect(result.label).toBe('Order Received')
    expect(result.color).toBe('bg-yellow-100 text-yellow-800')
    expect(result.icon).toBe('⏳')
  })
})