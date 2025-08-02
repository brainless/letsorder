import { A } from '@solidjs/router';
import { Dialog } from '@kobalte/core';
import { useUI } from '../contexts/UIContext';
import { For } from 'solid-js';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '🏠' },
  { name: 'Restaurants', href: '/restaurants', icon: '🏪' },
  // These links are placeholders as their pages are not yet implemented
  // { name: 'Menu', href: '/restaurants/some-id/menu', icon: '📋' },
  // { name: 'Tables & QR', href: '/restaurants/some-id/tables', icon: '🏷️' },
  // { name: 'Orders', href: '/orders', icon: '📦' },
];

function SidebarContent() {
  const ui = useUI();
  return (
    <div class="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-4">
      <div class="flex h-16 shrink-0 items-center">
        <span class="text-white text-xl font-bold">LetsOrder</span>
      </div>
      <nav class="flex flex-1 flex-col">
        <ul role="list" class="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" class="-mx-2 space-y-1">
              <For each={navigation}>
                {(item) => (
                  <li>
                    <A
                      href={item.href}
                      class="text-gray-300 hover:text-white hover:bg-gray-800 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                      activeClass="bg-gray-800 text-white"
                      onClick={() => ui.setSidebarOpen(false)}
                    >
                      <span class="text-lg">{item.icon}</span>
                      {item.name}
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function Sidebar() {
  const ui = useUI();

  return (
    <>
      {/* Mobile sidebar */}
      <Dialog.Root open={ui.isSidebarOpen()} onOpenChange={ui.setSidebarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
          <div class="fixed inset-0 z-50 flex">
            <Dialog.Content class="w-64 bg-gray-900 transition-transform duration-300 ease-in-out transform -translate-x-full data-[expanded]:translate-x-0">
              <SidebarContent />
            </Dialog.Content>
            <Dialog.CloseButton class="absolute top-4 right-4 text-white">
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Dialog.CloseButton>
          </div>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Desktop sidebar */}
      <div class="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent />
      </div>
    </>
  );
}

export default Sidebar;
