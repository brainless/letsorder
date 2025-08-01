import { Component, Show, For } from 'solid-js';
import type { MenuSectionWithItems } from '../../types/menu';
import type { Restaurant } from '../../types/restaurant';

interface MenuPreviewProps {
  restaurant: Restaurant;
  sections: MenuSectionWithItems[];
}

const MenuPreview: Component<MenuPreviewProps> = (props) => {
  return (
    <div class="max-w-2xl mx-auto bg-white">
      {/* Restaurant Header */}
      <div class="text-center py-8 px-6 bg-gradient-to-b from-blue-50 to-white border-b border-gray-200">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">{props.restaurant.name}</h1>
        <Show when={props.restaurant.address}>
          <p class="text-gray-600">{props.restaurant.address}</p>
        </Show>
      </div>

      {/* Menu Sections */}
      <div class="px-6 py-6">
        <Show 
          when={props.sections.length > 0}
          fallback={
            <div class="text-center py-12">
              <div class="text-gray-400 text-lg mb-2">No menu items available</div>
              <p class="text-gray-500">Please check back later.</p>
            </div>
          }
        >
          <div class="space-y-8">
            <For each={props.sections}>
              {(section) => (
                <div class="border-b border-gray-100 last:border-b-0 pb-8 last:pb-0">
                  <h2 class="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-blue-600 inline-block">
                    {section.name}
                  </h2>
                  
                  <Show 
                    when={section.items.filter(item => item.available).length > 0}
                    fallback={
                      <p class="text-gray-500 italic">No items available in this section.</p>
                    }
                  >
                    <div class="space-y-4">
                      <For each={section.items.filter(item => item.available)}>
                        {(item) => (
                          <div class="flex justify-between items-start p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div class="flex-1 pr-4">
                              <h3 class="font-medium text-gray-900 mb-1">{item.name}</h3>
                              <Show when={item.description}>
                                <p class="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                              </Show>
                            </div>
                            <div class="flex-shrink-0">
                              <span class="text-lg font-semibold text-green-600">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Footer */}
      <div class="text-center py-6 px-6 bg-gray-50 border-t border-gray-200">
        <p class="text-sm text-gray-500">
          Thank you for choosing {props.restaurant.name}!
        </p>
        <p class="text-xs text-gray-400 mt-1">
          Powered by LetsOrder
        </p>
      </div>
    </div>
  );
};

export default MenuPreview;