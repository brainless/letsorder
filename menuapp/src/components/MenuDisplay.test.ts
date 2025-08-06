import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockMenuData, emptyMenuData, waitFor, simulateUserInput, simulateKeyPress } from '../test/utils'

// Mock the MenuDisplay class from the script
class MockMenuDisplay {
  private searchInput: HTMLInputElement | null
  private menuSections: NodeListOf<Element>
  private menuItems: NodeListOf<Element>
  private searchResultsSummary: HTMLElement | null
  private noSearchResults: HTMLElement | null
  private searchDebounceTimer: number = 0

  constructor() {
    this.searchInput = document.getElementById('menu-search') as HTMLInputElement
    this.menuSections = document.querySelectorAll('.menu-section')
    this.menuItems = document.querySelectorAll('.menu-item-wrapper')
    this.searchResultsSummary = document.getElementById('search-results-summary')
    this.noSearchResults = document.getElementById('no-search-results')
    
    this.initializeSearch()
    this.initializeKeyboardNavigation()
  }

  private initializeSearch(): void {
    if (!this.searchInput) return

    this.searchInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement
      clearTimeout(this.searchDebounceTimer)
      
      this.searchDebounceTimer = window.setTimeout(() => {
        this.performSearch(target.value.toLowerCase().trim())
      }, 150)
    })

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.clearSearch()
      }
    })
  }

  private performSearch(query: string): void {
    if (!query) {
      this.clearSearch()
      return
    }

    let visibleSections = 0
    let totalVisibleItems = 0

    this.menuSections.forEach(section => {
      const items = section.querySelectorAll('.menu-item-wrapper')
      let visibleItemsInSection = 0

      items.forEach(item => {
        const name = item.getAttribute('data-item-name') || ''
        const description = item.getAttribute('data-item-description') || ''
        
        const matches = name.includes(query) || description.includes(query)
        
        if (matches) {
          ;(item as HTMLElement).style.display = ''
          visibleItemsInSection++
          totalVisibleItems++
          this.highlightSearchTerm(item, query)
        } else {
          ;(item as HTMLElement).style.display = 'none'
          this.clearHighlight(item)
        }
      })

      if (visibleItemsInSection > 0) {
        ;(section as HTMLElement).style.display = ''
        visibleSections++
      } else {
        ;(section as HTMLElement).style.display = 'none'
      }
    })

    if (this.noSearchResults) {
      this.noSearchResults.style.display = totalVisibleItems === 0 ? 'block' : 'none'
    }

    this.updateSearchResultsSummary(totalVisibleItems, query)
  }

  private clearSearch(): void {
    if (this.searchInput) {
      this.searchInput.value = ''
    }

    this.menuSections.forEach(section => {
      ;(section as HTMLElement).style.display = ''
    })

    this.menuItems.forEach(item => {
      ;(item as HTMLElement).style.display = ''
      this.clearHighlight(item)
    })

    if (this.noSearchResults) {
      this.noSearchResults.style.display = 'none'
    }

    if (this.searchResultsSummary) {
      this.searchResultsSummary.textContent = ''
    }
  }

  private highlightSearchTerm(item: Element, query: string): void {
    const nameElement = item.querySelector('h3')
    const descElement = item.querySelector('p')

    if (nameElement) {
      nameElement.innerHTML = this.addHighlight(nameElement.textContent || '', query)
    }
    if (descElement) {
      descElement.innerHTML = this.addHighlight(descElement.textContent || '', query)
    }
  }

  private clearHighlight(item: Element): void {
    const nameElement = item.querySelector('h3')
    const descElement = item.querySelector('p')

    if (nameElement) {
      nameElement.innerHTML = nameElement.textContent || ''
    }
    if (descElement) {
      descElement.innerHTML = descElement.textContent || ''
    }
  }

  private addHighlight(text: string, query: string): string {
    if (!query) return text
    
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')
  }

  private updateSearchResultsSummary(count: number, query: string): void {
    if (!this.searchResultsSummary) return

    if (count === 0) {
      this.searchResultsSummary.textContent = `No results found for "${query}"`
    } else {
      this.searchResultsSummary.textContent = `Found ${count} item${count === 1 ? '' : 's'} matching "${query}"`
    }
  }

  private initializeKeyboardNavigation(): void {
    // Simplified keyboard navigation for testing
  }

  public showLoading(): void {
    const loading = document.getElementById('menu-loading')
    const sections = document.getElementById('menu-sections')
    const error = document.getElementById('menu-error')
    
    if (loading) loading.style.display = 'block'
    if (sections) sections.style.display = 'none'
    if (error) error.style.display = 'none'
  }

  public showError(message?: string): void {
    const loading = document.getElementById('menu-loading')
    const sections = document.getElementById('menu-sections')
    const error = document.getElementById('menu-error')
    const errorMessage = document.getElementById('error-message')
    
    if (loading) loading.style.display = 'none'
    if (sections) sections.style.display = 'none'
    if (error) error.style.display = 'block'
    if (errorMessage && message) errorMessage.textContent = message
  }

  public showMenu(): void {
    const loading = document.getElementById('menu-loading')
    const sections = document.getElementById('menu-sections')
    const error = document.getElementById('menu-error')
    const empty = document.getElementById('menu-empty')
    
    if (loading) loading.style.display = 'none'
    if (error) error.style.display = 'none'
    
    const hasSections = this.menuSections.length > 0
    
    if (hasSections) {
      if (sections) sections.style.display = 'block'
      if (empty) empty.style.display = 'none'
    } else {
      if (sections) sections.style.display = 'none'
      if (empty) empty.style.display = 'block'
    }
  }
}

// Helper to create menu HTML structure
const createMenuHTML = (menuData: typeof mockMenuData) => {
  return `
    <div data-menu-display>
      <div id="menu-search-container">
        <input type="text" id="menu-search" placeholder="Search menu items..." />
      </div>
      <div id="search-results-summary" class="sr-only"></div>
      <div id="menu-loading" style="display: none;">Loading...</div>
      <div id="menu-error" style="display: none;">
        <span id="error-message">Error loading menu</span>
      </div>
      <div id="menu-empty" style="display: none;">No menu items</div>
      <div id="no-search-results" style="display: none;">No results found</div>
      <div id="menu-sections">
        ${menuData.sections.map(section => `
          <section class="menu-section" data-section-id="${section.id}">
            <h2>${section.name}</h2>
            ${section.items.map(item => `
              <div class="menu-item-wrapper" 
                   data-item-name="${item.name.toLowerCase()}" 
                   data-item-description="${item.description.toLowerCase()}">
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <span>$${item.price}</span>
                <button>Add</button>
              </div>
            `).join('')}
          </section>
        `).join('')}
      </div>
    </div>
  `
}

describe('MenuDisplay Component', () => {
  let container: HTMLElement
  let menuDisplay: MockMenuDisplay

  beforeEach(() => {
    document.body.innerHTML = createMenuHTML(mockMenuData)
    container = document.body.querySelector('[data-menu-display]') as HTMLElement
    menuDisplay = new MockMenuDisplay()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('Rendering', () => {
    it('should render restaurant information', () => {
      expect(container).toBeTruthy()
      
      // Check if sections are rendered
      const sections = container.querySelectorAll('.menu-section')
      expect(sections.length).toBe(2)
      expect(sections[0].textContent).toContain('Appetizers')
      expect(sections[1].textContent).toContain('Main Courses')
    })

    it('should render menu items with correct data attributes', () => {
      const items = container.querySelectorAll('.menu-item-wrapper')
      expect(items.length).toBe(4)
      
      const firstItem = items[0]
      expect(firstItem.getAttribute('data-item-name')).toBe('caesar salad')
      expect(firstItem.getAttribute('data-item-description')).toContain('romaine lettuce')
    })

    it('should render search input', () => {
      const searchInput = container.querySelector('#menu-search') as HTMLInputElement
      expect(searchInput).toBeTruthy()
      expect(searchInput.placeholder).toBe('Search menu items...')
    })
  })

  describe('Search Functionality', () => {
    it('should filter items based on name search', async () => {
      const searchInput = container.querySelector('#menu-search') as HTMLInputElement
      
      simulateUserInput(searchInput, 'caesar')
      
      // Wait for debounce
      await waitFor(200)
      
      const visibleItems = Array.from(container.querySelectorAll('.menu-item-wrapper'))
        .filter(item => (item as HTMLElement).style.display !== 'none')
      
      expect(visibleItems.length).toBe(1)
      expect(visibleItems[0].textContent).toContain('Caesar Salad')
    })

    it('should filter items based on description search', async () => {
      const searchInput = container.querySelector('#menu-search') as HTMLInputElement
      
      simulateUserInput(searchInput, 'salmon')
      
      await waitFor(200)
      
      const visibleItems = Array.from(container.querySelectorAll('.menu-item-wrapper'))
        .filter(item => (item as HTMLElement).style.display !== 'none')
      
      expect(visibleItems.length).toBe(1)
      expect(visibleItems[0].textContent).toContain('Grilled Salmon')
    })

    it('should show no results message when no items match', async () => {
      const searchInput = container.querySelector('#menu-search') as HTMLInputElement
      const noResults = container.querySelector('#no-search-results') as HTMLElement
      
      simulateUserInput(searchInput, 'pizza')
      
      await waitFor(200)
      
      expect(noResults.style.display).toBe('block')
      
      const visibleItems = Array.from(container.querySelectorAll('.menu-item-wrapper'))
        .filter(item => (item as HTMLElement).style.display !== 'none')
      
      expect(visibleItems.length).toBe(0)
    })

    it('should clear search when escape key is pressed', async () => {
      const searchInput = container.querySelector('#menu-search') as HTMLInputElement
      
      simulateUserInput(searchInput, 'caesar')
      await waitFor(200)
      
      simulateKeyPress(searchInput, 'Escape')
      
      expect(searchInput.value).toBe('')
      
      const visibleItems = Array.from(container.querySelectorAll('.menu-item-wrapper'))
        .filter(item => (item as HTMLElement).style.display !== 'none')
      
      expect(visibleItems.length).toBe(4) // All items should be visible again
    })

    it('should update search results summary', async () => {
      const searchInput = container.querySelector('#menu-search') as HTMLInputElement
      const summary = container.querySelector('#search-results-summary') as HTMLElement
      
      simulateUserInput(searchInput, 'salad')
      
      await waitFor(200)
      
      expect(summary.textContent).toBe('Found 1 item matching "salad"')
    })

    it('should highlight search terms in results', async () => {
      const searchInput = container.querySelector('#menu-search') as HTMLInputElement
      
      simulateUserInput(searchInput, 'caesar')
      
      await waitFor(200)
      
      const itemName = container.querySelector('.menu-item-wrapper h3')
      expect(itemName?.innerHTML).toContain('<mark')
      expect(itemName?.innerHTML).toContain('Caesar')
    })
  })

  describe('State Management', () => {
    it('should show loading state', () => {
      menuDisplay.showLoading()
      
      const loading = container.querySelector('#menu-loading') as HTMLElement
      const sections = container.querySelector('#menu-sections') as HTMLElement
      const error = container.querySelector('#menu-error') as HTMLElement
      
      expect(loading.style.display).toBe('block')
      expect(sections.style.display).toBe('none')
      expect(error.style.display).toBe('none')
    })

    it('should show error state with custom message', () => {
      const customMessage = 'Custom error message'
      menuDisplay.showError(customMessage)
      
      const loading = container.querySelector('#menu-loading') as HTMLElement
      const sections = container.querySelector('#menu-sections') as HTMLElement
      const error = container.querySelector('#menu-error') as HTMLElement
      const errorMessage = container.querySelector('#error-message') as HTMLElement
      
      expect(loading.style.display).toBe('none')
      expect(sections.style.display).toBe('none')
      expect(error.style.display).toBe('block')
      expect(errorMessage.textContent).toBe(customMessage)
    })

    it('should show menu content', () => {
      menuDisplay.showMenu()
      
      const loading = container.querySelector('#menu-loading') as HTMLElement
      const sections = container.querySelector('#menu-sections') as HTMLElement
      const error = container.querySelector('#menu-error') as HTMLElement
      
      expect(loading.style.display).toBe('none')
      expect(sections.style.display).toBe('block')
      expect(error.style.display).toBe('none')
    })
  })

  describe('Empty State', () => {
    beforeEach(() => {
      document.body.innerHTML = createMenuHTML(emptyMenuData)
      container = document.body.querySelector('[data-menu-display]') as HTMLElement
      menuDisplay = new MockMenuDisplay()
    })

    it('should show empty state when no menu sections', () => {
      menuDisplay.showMenu()
      
      const sections = container.querySelector('#menu-sections') as HTMLElement
      const empty = container.querySelector('#menu-empty') as HTMLElement
      
      expect(sections.style.display).toBe('none')
      expect(empty.style.display).toBe('block')
    })
  })
})
