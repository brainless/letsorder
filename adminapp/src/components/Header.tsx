import { createSignal } from 'solid-js';

function Header() {
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);

  return (
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div class="relative flex flex-1">
          <h1 class="text-xl font-semibold text-gray-900 self-center">LetsOrder Admin</h1>
        </div>
        <div class="flex items-center gap-x-4 lg:gap-x-6">
          {/* Profile dropdown */}
          <div class="relative">
            <button
              type="button"
              class="-m-1.5 flex items-center p-1.5"
              onClick={() => setUserMenuOpen(!userMenuOpen())}
            >
              <span class="sr-only">Open user menu</span>
              <div class="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center">
                <span class="text-sm font-medium text-white">A</span>
              </div>
              <span class="hidden lg:flex lg:items-center">
                <span class="ml-4 text-sm font-semibold leading-6 text-gray-900">Admin User</span>
              </span>
            </button>
            
            {userMenuOpen() && (
              <div class="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5">
                <a href="#" class="block px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50">
                  Profile
                </a>
                <a href="#" class="block px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50">
                  Sign out
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;