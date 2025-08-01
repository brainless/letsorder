import { A } from '@solidjs/router';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '🏠' },
  { name: 'Restaurants', href: '/restaurants', icon: '🏪' },
  { name: 'Menu', href: '/menu', icon: '📋' },
  { name: 'Tables & QR', href: '/tables', icon: '🏷️' },
  { name: 'Orders', href: '/orders', icon: '📦' },
];

function Sidebar() {
  return (
    <div class="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div class="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-4">
        <div class="flex h-16 shrink-0 items-center">
          <span class="text-white text-xl font-bold">LetsOrder</span>
        </div>
        <nav class="flex flex-1 flex-col">
          <ul role="list" class="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" class="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li>
                    <A
                      href={item.href}
                      class="text-gray-300 hover:text-white hover:bg-gray-800 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                      activeClass="bg-gray-800 text-white"
                    >
                      <span class="text-lg">{item.icon}</span>
                      {item.name}
                    </A>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default Sidebar;