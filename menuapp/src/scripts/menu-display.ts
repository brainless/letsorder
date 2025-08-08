/**
 * Optimized Menu Display functionality with minimal JavaScript
 */
export class MenuDisplay {
  private searchInput: HTMLInputElement | null;
  private menuSections: NodeListOf<Element>;
  private menuItems: NodeListOf<Element>;
  private searchResultsSummary: HTMLElement | null;
  private noSearchResults: HTMLElement | null;
  private searchDebounceTimer: number = 0;

  constructor() {
    this.searchInput = document.getElementById('menu-search') as HTMLInputElement;
    this.menuSections = document.querySelectorAll('.menu-section');
    this.menuItems = document.querySelectorAll('.menu-item-wrapper');
    this.searchResultsSummary = document.getElementById('search-results-summary');
    this.noSearchResults = document.getElementById('no-search-results');
    
    this.initializeSearch();
    this.initializeKeyboardNavigation();
    this.initializeLazyLoading();
  }

  private initializeSearch(): void {
    if (!this.searchInput) return;

    // Use passive listeners and arrow functions for better performance
    this.searchInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      clearTimeout(this.searchDebounceTimer);
      
      this.searchDebounceTimer = window.setTimeout(() => {
        this.performSearch(target.value.toLowerCase().trim());
      }, 150);
    }, { passive: true });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.clearSearch();
      }
    });
  }

  private performSearch(query: string): void {
    if (!query) {
      this.clearSearch();
      return;
    }

    let visibleSections = 0;
    let totalVisibleItems = 0;

    // Use for...of for better performance than forEach
    for (const section of this.menuSections) {
      const items = section.querySelectorAll('.menu-item-wrapper');
      let visibleItemsInSection = 0;

      for (const item of items) {
        const name = item.getAttribute('data-item-name') || '';
        const description = item.getAttribute('data-item-description') || '';
        
        const matches = name.includes(query) || description.includes(query);
        
        if (matches) {
          (item as HTMLElement).style.display = '';
          visibleItemsInSection++;
          totalVisibleItems++;
          this.highlightSearchTerm(item, query);
        } else {
          (item as HTMLElement).style.display = 'none';
          this.clearHighlight(item);
        }
      }

      // Show/hide section based on visible items
      if (visibleItemsInSection > 0) {
        (section as HTMLElement).style.display = '';
        visibleSections++;
      } else {
        (section as HTMLElement).style.display = 'none';
      }
    }

    // Update UI elements
    if (this.noSearchResults) {
      this.noSearchResults.style.display = totalVisibleItems === 0 ? 'block' : 'none';
    }

    this.updateSearchResultsSummary(totalVisibleItems, query);
  }

  private clearSearch(): void {
    if (this.searchInput) {
      this.searchInput.value = '';
    }

    // Batch DOM operations for better performance
    requestAnimationFrame(() => {
      for (const section of this.menuSections) {
        (section as HTMLElement).style.display = '';
      }

      for (const item of this.menuItems) {
        (item as HTMLElement).style.display = '';
        this.clearHighlight(item);
      }

      if (this.noSearchResults) {
        this.noSearchResults.style.display = 'none';
      }

      if (this.searchResultsSummary) {
        this.searchResultsSummary.textContent = '';
      }
    });
  }

  private highlightSearchTerm(item: Element, query: string): void {
    const nameElement = item.querySelector('h3');
    const descElement = item.querySelector('p');

    if (nameElement) {
      nameElement.innerHTML = this.addHighlight(nameElement.textContent || '', query);
    }
    if (descElement) {
      descElement.innerHTML = this.addHighlight(descElement.textContent || '', query);
    }
  }

  private clearHighlight(item: Element): void {
    const nameElement = item.querySelector('h3');
    const descElement = item.querySelector('p');

    if (nameElement) {
      nameElement.innerHTML = nameElement.textContent || '';
    }
    if (descElement) {
      descElement.innerHTML = descElement.textContent || '';
    }
  }

  private addHighlight(text: string, query: string): string {
    if (!query) return text;
    
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private updateSearchResultsSummary(count: number, query: string): void {
    if (!this.searchResultsSummary) return;

    this.searchResultsSummary.textContent = count === 0 
      ? `No results found for "${query}"`
      : `Found ${count} item${count === 1 ? '' : 's'} matching "${query}"`;
  }

  private initializeKeyboardNavigation(): void {
    // Lightweight keyboard navigation
    const menuButtons = document.querySelectorAll('.menu-item-wrapper button');
    
    for (let i = 0; i < menuButtons.length; i++) {
      const button = menuButtons[i];
      button.addEventListener('keydown', (e) => {
        const event = e as KeyboardEvent;
        
        switch (event.key) {
          case 'ArrowDown':
            e.preventDefault();
            this.focusNextButton(i, menuButtons);
            break;
          case 'ArrowUp':
            e.preventDefault();
            this.focusPrevButton(i, menuButtons);
            break;
          case 'Home':
            e.preventDefault();
            (menuButtons[0] as HTMLElement)?.focus();
            break;
          case 'End':
            e.preventDefault();
            (menuButtons[menuButtons.length - 1] as HTMLElement)?.focus();
            break;
        }
      });
    }
  }

  private focusNextButton(currentIndex: number, buttons: NodeListOf<Element>): void {
    const visibleButtons = Array.from(buttons).filter(btn => 
      (btn as HTMLElement).offsetParent !== null
    );
    const currentVisibleIndex = visibleButtons.indexOf(buttons[currentIndex]);
    const nextIndex = (currentVisibleIndex + 1) % visibleButtons.length;
    (visibleButtons[nextIndex] as HTMLElement).focus();
  }

  private focusPrevButton(currentIndex: number, buttons: NodeListOf<Element>): void {
    const visibleButtons = Array.from(buttons).filter(btn => 
      (btn as HTMLElement).offsetParent !== null
    );
    const currentVisibleIndex = visibleButtons.indexOf(buttons[currentIndex]);
    const prevIndex = currentVisibleIndex === 0 ? visibleButtons.length - 1 : currentVisibleIndex - 1;
    (visibleButtons[prevIndex] as HTMLElement).focus();
  }

  // State management methods
  public showLoading(): void {
    const loading = document.getElementById('menu-loading');
    const sections = document.getElementById('menu-sections');
    const error = document.getElementById('menu-error');
    
    if (loading) loading.style.display = 'block';
    if (sections) sections.style.display = 'none';
    if (error) error.style.display = 'none';
  }

  public showError(message?: string): void {
    const loading = document.getElementById('menu-loading');
    const sections = document.getElementById('menu-sections');
    const error = document.getElementById('menu-error');
    const errorMessage = document.getElementById('error-message');
    
    if (loading) loading.style.display = 'none';
    if (sections) sections.style.display = 'none';
    if (error) error.style.display = 'block';
    if (errorMessage && message) errorMessage.textContent = message;
  }

  public showMenu(): void {
    const loading = document.getElementById('menu-loading');
    const sections = document.getElementById('menu-sections');
    const error = document.getElementById('menu-error');
    const empty = document.getElementById('menu-empty');
    
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'none';
    
    const hasSections = this.menuSections.length > 0;
    
    if (hasSections) {
      if (sections) sections.style.display = 'block';
      if (empty) empty.style.display = 'none';
    } else {
      if (sections) sections.style.display = 'none';
      if (empty) empty.style.display = 'block';
    }
  }

  private initializeLazyLoading(): void {
    // Use Intersection Observer for lazy loading menu sections
    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers - load all sections immediately
      this.loadAllSections();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const section = entry.target as HTMLElement;
          this.loadLazySection(section);
          observer.unobserve(section);
        }
      });
    }, {
      rootMargin: '50px 0px', // Start loading when section is 50px from viewport
      threshold: 0.1
    });

    // Observe all lazy sections
    document.querySelectorAll('.lazy-content').forEach(section => {
      observer.observe(section.closest('.lazy-section') as Element);
    });
  }

  private loadLazySection(section: HTMLElement): void {
    const lazyContent = section.querySelector('.lazy-content');
    if (!lazyContent) return;

    const itemsData = lazyContent.getAttribute('data-section-items');
    const sectionName = lazyContent.getAttribute('data-section-name');
    
    if (!itemsData || !sectionName) return;

    try {
      const items = JSON.parse(itemsData);
      const itemsContainer = lazyContent.parentElement;
      
      if (itemsContainer) {
        // Create menu items HTML
        const itemsHTML = items.map((item: any) => `
          <div role="listitem" class="menu-item-wrapper" data-item-name="${item.name.toLowerCase()}" data-item-description="${(item.description || '').toLowerCase()}">
            <div class="flex justify-between items-start p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <div class="flex-1 min-w-0 mr-4">
                <h3 class="text-lg font-medium text-gray-900 mb-1">${item.name}</h3>
                ${item.description ? `<p class="text-sm text-gray-600 mb-2">${item.description}</p>` : ''}
                <p class="text-lg font-semibold text-blue-600">$${item.price.toFixed(2)}</p>
              </div>
              <button 
                type="button"
                class="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                data-item-id="${item.id}"
                data-item-name="${item.name}"
                data-item-price="${item.price}"
                data-section-name="${sectionName}"
                aria-label="Add ${item.name} to cart"
              >
                Add
              </button>
            </div>
          </div>
        `).join('');
        
        // Replace lazy content with actual items
        itemsContainer.innerHTML = itemsHTML;
        
        // Update menuItems collection
        this.menuItems = document.querySelectorAll('.menu-item-wrapper');
        
        // Initialize keyboard navigation for new items
        this.initializeKeyboardNavigation();
      }
    } catch (error) {
      console.warn('Failed to load lazy section:', error);
      // Remove loading indicator on error
      if (lazyContent.parentElement) {
        lazyContent.parentElement.innerHTML = '<p class="text-gray-500 text-center py-4 italic">Failed to load menu items</p>';
      }
    }
  }

  private loadAllSections(): void {
    // Fallback for browsers without Intersection Observer
    document.querySelectorAll('.lazy-section').forEach(section => {
      this.loadLazySection(section as HTMLElement);
    });
  }
}

// Initialize only when needed - use intersection observer for lazy loading
const initializeMenuDisplay = () => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new MenuDisplay());
  } else {
    new MenuDisplay();
  }
};

// Only initialize if we're on a menu page
if (document.querySelector('[data-menu-display]')) {
  initializeMenuDisplay();
}

// Export for external use
export default MenuDisplay;