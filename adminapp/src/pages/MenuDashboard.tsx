import { Component, createSignal, Show, For, onMount } from 'solid-js';
import { useParams } from '@solidjs/router';
import { MenuProvider, useMenu } from '../contexts/MenuContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import MenuModal from '../components/menu/MenuModal';
import MenuSectionForm from '../components/menu/MenuSectionForm';
import MenuItemForm from '../components/menu/MenuItemForm';
import type { MenuSection, MenuItem } from '../types/menu';

const MenuDashboard: Component = () => {
  const params = useParams<{ restaurantId: string }>();
  
  return (
    <MenuProvider restaurantId={params.restaurantId}>
      <MenuDashboardContent />
    </MenuProvider>
  );
};

const MenuDashboardContent: Component = () => {
  const menu = useMenu();
  const restaurant = useRestaurant();
  const params = useParams<{ restaurantId: string }>();
  
  const [previewMode, setPreviewMode] = createSignal(false);
  const [selectedItems, setSelectedItems] = createSignal<string[]>([]);
  const [selectedSections, setSelectedSections] = createSignal<string[]>([]);
  
  // Modal states
  const [showSectionModal, setShowSectionModal] = createSignal(false);
  const [showItemModal, setShowItemModal] = createSignal(false);
  const [editingSection, setEditingSection] = createSignal<MenuSection | null>(null);
  const [editingItem, setEditingItem] = createSignal<MenuItem | null>(null);
  const [currentSectionId, setCurrentSectionId] = createSignal<string>('');

  onMount(() => {
    restaurant.loadRestaurant(params.restaurantId);
  });

  // Modal handlers
  const openCreateSectionModal = () => {
    setEditingSection(null);
    setShowSectionModal(true);
  };

  const openEditSectionModal = (section: MenuSection) => {
    setEditingSection(section);
    setShowSectionModal(true);
  };

  const closeModals = () => {
    setShowSectionModal(false);
    setShowItemModal(false);
    setEditingSection(null);
    setEditingItem(null);
    setCurrentSectionId('');
  };

  const openCreateItemModal = (sectionId: string) => {
    setCurrentSectionId(sectionId);
    setEditingItem(null);
    setShowItemModal(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItem(item);
    setCurrentSectionId(item.section_id);
    setShowItemModal(true);
  };

  const handleFormSuccess = () => {
    closeModals();
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleSectionSelection = (sectionId: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleBulkDelete = async () => {
    const itemIds = selectedItems();
    const sectionIds = selectedSections();
    
    if (itemIds.length === 0 && sectionIds.length === 0) return;
    
    try {
      if (itemIds.length > 0) {
        await menu.bulkDeleteItems(itemIds);
      }
      if (sectionIds.length > 0) {
        await menu.bulkDeleteSections(sectionIds);
      }
      setSelectedItems([]);
      setSelectedSections([]);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const handleBulkToggleAvailability = async (available: boolean) => {
    const itemIds = selectedItems();
    if (itemIds.length === 0) return;
    
    try {
      await menu.bulkToggleAvailability(itemIds, available);
      setSelectedItems([]);
    } catch (err) {
      console.error('Bulk availability toggle failed:', err);
    }
  };

  return (
    <div class="p-6">
      {/* Header */}
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Menu Management</h1>
          <Show when={restaurant.currentRestaurant}>
            <p class="text-gray-600">{restaurant.currentRestaurant!.name}</p>
          </Show>
        </div>
        
        <div class="flex gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode())}
            class={`px-4 py-2 rounded-lg font-medium ${
              previewMode()
                ? 'bg-gray-100 text-gray-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {previewMode() ? 'Exit Preview' : 'Preview Menu'}
          </button>
          
          <Show when={!previewMode()}>
            <button
              onClick={openCreateSectionModal}
              class="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700"
            >
              Add Section
            </button>
          </Show>
        </div>
      </div>

      {/* Error Display */}
      <Show when={menu.error}>
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex justify-between items-center">
            <p class="text-red-800">{menu.error}</p>
            <button
              onClick={menu.clearError}
              class="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      </Show>

      {/* Bulk Actions */}
      <Show when={!previewMode() && (selectedItems().length > 0 || selectedSections().length > 0)}>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-4">
            <span class="text-blue-800 font-medium">
              {selectedItems().length + selectedSections().length} items selected
            </span>
            
            <div class="flex gap-2">
              <Show when={selectedItems().length > 0}>
                <button
                  onClick={() => handleBulkToggleAvailability(true)}
                  class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Make Available
                </button>
                <button
                  onClick={() => handleBulkToggleAvailability(false)}
                  class="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                >
                  Make Unavailable
                </button>
              </Show>
              
              <button
                onClick={handleBulkDelete}
                class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={menu.isLoading}>
        <div class="flex items-center justify-center h-64">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Show>

      {/* Menu Content */}
      <Show when={!menu.isLoading}>
        <Show 
          when={menu.sections.length > 0}
          fallback={
            <div class="text-center py-12">
              <div class="text-gray-400 text-lg mb-4">No menu sections yet</div>
              <Show when={!previewMode()}>
                <button
                  onClick={openCreateSectionModal}
                  class="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
                >
                  Create Your First Section
                </button>
              </Show>
            </div>
          }
        >
          <div class="space-y-6">
            <For each={menu.sections}>
              {(section) => (
                <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {/* Section Header */}
                  <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <Show when={!previewMode()}>
                          <input
                            type="checkbox"
                            checked={selectedSections().includes(section.id)}
                            onChange={() => toggleSectionSelection(section.id)}
                            class="rounded border-gray-300"
                          />
                        </Show>
                        
                        <h3 class="text-lg font-semibold text-gray-900">
                          {section.name}
                        </h3>
                        
                        <span class="text-sm text-gray-500">
                          ({section.items.length} items)
                        </span>
                      </div>
                      
                      <Show when={!previewMode()}>
                        <div class="flex items-center gap-2">
                          <button
                            onClick={() => openCreateItemModal(section.id)}
                            class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Add Item
                          </button>
                          <button
                            onClick={() => openEditSectionModal(section)}
                            class="text-gray-600 hover:text-gray-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the section "${section.name}"? This will also delete all items in this section.`)) {
                                menu.deleteSection(section.id);
                              }
                            }}
                            class="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>

                  {/* Section Items */}
                  <div class="divide-y divide-gray-100">
                    <Show 
                      when={section.items.length > 0}
                      fallback={
                        <div class="px-6 py-8 text-center text-gray-500">
                          No items in this section yet
                          <Show when={!previewMode()}>
                            <button
                              onClick={() => openCreateItemModal(section.id)}
                              class="block mx-auto mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Add the first item
                            </button>
                          </Show>
                        </div>
                      }
                    >
                      <For each={section.items}>
                        {(item) => (
                          <div class="px-6 py-4">
                            <div class="flex items-center justify-between">
                              <div class="flex items-center gap-3 flex-1">
                                <Show when={!previewMode()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedItems().includes(item.id)}
                                    onChange={() => toggleItemSelection(item.id)}
                                    class="rounded border-gray-300"
                                  />
                                </Show>
                                
                                <div class="flex-1">
                                  <div class="flex items-center gap-3">
                                    <h4 class="font-medium text-gray-900">
                                      {item.name}
                                    </h4>
                                    
                                    <span class="font-semibold text-green-600">
                                      ${item.price.toFixed(2)}
                                    </span>
                                    
                                    <Show when={!item.available}>
                                      <span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                        Unavailable
                                      </span>
                                    </Show>
                                  </div>
                                  
                                  <Show when={item.description}>
                                    <p class="text-gray-600 text-sm mt-1">
                                      {item.description}
                                    </p>
                                  </Show>
                                </div>
                              </div>
                              
                              <Show when={!previewMode()}>
                                <div class="flex items-center gap-2">
                                  <button
                                    onClick={() => menu.toggleItemAvailability(item.id, !item.available)}
                                    class={`text-xs px-2 py-1 rounded font-medium ${
                                      item.available
                                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                    }`}
                                  >
                                    {item.available ? 'Disable' : 'Enable'}
                                  </button>
                                  
                                  <button
                                    onClick={() => openEditItemModal(item)}
                                    class="text-gray-600 hover:text-gray-800 text-sm"
                                  >
                                    Edit
                                  </button>
                                  
                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                                        menu.deleteItem(item.id);
                                      }
                                    }}
                                    class="text-red-600 hover:text-red-800 text-sm"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </Show>
                            </div>
                          </div>
                        )}
                      </For>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      {/* Modals */}
      <MenuModal isOpen={showSectionModal()} onClose={closeModals}>
        <MenuSectionForm
          restaurantId={params.restaurantId}
          section={editingSection()}
          onSuccess={handleFormSuccess}
          onCancel={closeModals}
        />
      </MenuModal>

      <MenuModal isOpen={showItemModal()} onClose={closeModals}>
        <MenuItemForm
          sectionId={currentSectionId()}
          item={editingItem()}
          onSuccess={handleFormSuccess}
          onCancel={closeModals}
        />
      </MenuModal>
    </div>
  );
};

export default MenuDashboard;