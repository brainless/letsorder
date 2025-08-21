/**
 * Optimized Menu Display functionality with client-side rendering
 */
class MenuDisplay {
  private searchInput: HTMLInputElement | null;
  private menuSections: NodeListOf<Element>;
  private menuItems: NodeListOf<Element>;
  private searchResultsSummary: HTMLElement | null;
  private noSearchResults: HTMLElement | null;
  private searchDebounceTimer: number = 0;
  private restaurantCode: string;
  private tableCode: string;

  constructor() {
    console.log('[MenuDisplay] Constructor called');
    
    // Get restaurant and table codes from window data
    const pageData = (window as any).menuPageData;
    console.log('[MenuDisplay] Page data:', pageData);
    
    if (!pageData || !pageData.restaurantCode || !pageData.tableCode) {
      console.error('[MenuDisplay] Missing page data');
      throw new Error('Restaurant and table codes not found');
    }
    
    this.restaurantCode = pageData.restaurantCode;
    this.tableCode = pageData.tableCode;
    
    console.log('[MenuDisplay] Restaurant code:', this.restaurantCode);
    console.log('[MenuDisplay] Table code:', this.tableCode);
    
    this.searchInput = document.getElementById('menu-search') as HTMLInputElement;
    this.menuSections = document.querySelectorAll('.menu-section');
    this.menuItems = document.querySelectorAll('.menu-item-wrapper');
    this.searchResultsSummary = document.getElementById('search-results-summary');
    this.noSearchResults = document.getElementById('no-search-results');
    
    this.initializeMenu();
  }

  private async initializeMenu(): Promise<void> {
    try {
      console.log('[MenuDisplay] Starting menu initialization');
      this.showLoading();
      
      // Import the API function
      console.log('[MenuDisplay] Importing API module');
      const { fetchMenu } = await import('../lib/api.ts');
      console.log('[MenuDisplay] API module imported, fetching menu');
      const menuData = await fetchMenu(this.restaurantCode, this.tableCode);
      console.log('[MenuDisplay] Menu data received:', menuData);
      
      if (!menuData.restaurant) {
        this.showError('Restaurant not found');
        return;
      }
      
      if (!menuData.sections || menuData.sections.length === 0) {
        this.showEmptyMenu(menuData.restaurant.name);
        return;
      }
      
      this.renderMenu(menuData);
      this.initializeSearch();
      this.initializeKeyboardNavigation();
      this.initializeAddToCartButtons();
      this.showMenu();
      
    } catch (error) {
      console.error('Failed to load menu:', error);
      this.showError('Failed to load menu. Please try refreshing the page.');
    }
  }

  private renderMenu(menuData: any): void {
    // Update restaurant header
    const restaurantName = document.getElementById('restaurant-name');
    const restaurantAddress = document.getElementById('restaurant-address');
    
    if (restaurantName) {
      restaurantName.textContent = menuData.restaurant.name;
    }
    
    if (restaurantAddress && menuData.restaurant.address) {
      restaurantAddress.textContent = menuData.restaurant.address;
    } else if (restaurantAddress) {
      restaurantAddress.style.display = 'none';
    }

    // Render menu sections
    const sectionsContainer = document.getElementById('menu-sections');
    if (!sectionsContainer) return;

    const sectionsHTML = menuData.sections.map((section: any) => `
      <section 
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 menu-section" 
        data-section-id="${section.id}"
        role="region"
        aria-labelledby="section-title-${section.id}"
      >
        <h2 
          class="text-xl font-semibold text-gray-900 mb-4 section-title" 
          id="section-title-${section.id}"
        >
          ${section.name}
        </h2>
        
        ${section.items && section.items.length > 0 ? `
          <div class="space-y-4 section-items" role="list" aria-label="${section.name} items">
            ${section.items.map((item: any) => this.generateMenuItemHTML(item, section.name)).join('')}
          </div>
        ` : `
          <p class="text-gray-500 text-center py-4 italic">No items available in this section</p>
        `}
      </section>
    `).join('');

    sectionsContainer.innerHTML = sectionsHTML;

    // Update collections after rendering
    this.menuSections = document.querySelectorAll('.menu-section');
    this.menuItems = document.querySelectorAll('.menu-item-wrapper');
  }

  private generateMenuItemHTML(item: any, sectionName: string): string {
    return `
      <div role="listitem" class="menu-item-wrapper" data-item-name="${item.name.toLowerCase()}" data-item-description="${(item.description || '').toLowerCase()}">
        <div class="flex justify-between items-start p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
          <div class="flex-1 min-w-0 mr-4">
            <h3 class="text-lg font-medium text-gray-900 mb-1">${item.name}</h3>
            ${item.description ? `<p class="text-sm text-gray-600 mb-2">${item.description}</p>` : ''}
            <p class="text-lg font-semibold text-blue-600">$${item.price.toFixed(2)}</p>
          </div>
          <div class="flex-shrink-0">
            <div class="add-to-cart-container" data-item-id="${item.id}">
              <!-- Quantity selector (initially hidden) -->
              <div class="quantity-selector hidden items-center space-x-2 h-[32px]">
                <button 
                  type="button"
                  class="quantity-btn decrease-btn bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-full w-8 h-8 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex-shrink-0"
                  aria-label="Decrease quantity of ${item.name}"
                  data-action="decrease"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                  </svg>
                </button>
                
                <span class="quantity-display font-medium text-gray-900 min-w-[2ch] text-center text-sm px-2" role="status" aria-live="polite">
                  0
                </span>
                
                <button 
                  type="button"
                  class="quantity-btn increase-btn bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex-shrink-0"
                  aria-label="Increase quantity of ${item.name}"
                  data-action="increase"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                </button>
              </div>

              <!-- Initial "Add" button -->
              <button 
                type="button"
                class="add-btn bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 min-w-[60px] h-[32px] flex items-center justify-center"
                data-item-id="${item.id}"
                data-item-name="${item.name}"
                data-item-description="${item.description || ''}"
                data-item-price="${item.price}"
                data-section-name="${sectionName}"
                aria-label="Add ${item.name} to cart"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private async initializeAddToCartButtons(): Promise<void> {
    console.log('[MenuDisplay] Initializing Add to Cart buttons');
    
    // Use the existing AddToCartButton.astro initialization system
    // by dispatching custom events for each container
    const containers = document.querySelectorAll('.add-to-cart-container');
    console.log('[MenuDisplay] Found', containers.length, 'add-to-cart containers');
    
    containers.forEach((container) => {
      try {
        console.log('[MenuDisplay] Dispatching addToCartButtonInit event for:', container);
        const event = new CustomEvent('addToCartButtonInit', {
          detail: { container },
          bubbles: true
        });
        document.dispatchEvent(event);
      } catch (error) {
        console.error('Failed to dispatch addToCartButtonInit event:', error);
      }
    });
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

  public showEmptyMenu(restaurantName: string): void {
    const loading = document.getElementById('menu-loading');
    const sections = document.getElementById('menu-sections');
    const error = document.getElementById('menu-error');
    const empty = document.getElementById('menu-empty');
    
    if (loading) loading.style.display = 'none';
    if (sections) sections.style.display = 'none';
    if (error) error.style.display = 'none';
    if (empty) empty.style.display = 'block';
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
}

// Export the class for external use
export { MenuDisplay };
export default MenuDisplay;