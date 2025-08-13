import { RouteSectionProps } from '@solidjs/router';
import Sidebar from './Sidebar';
import Header from './Header';

function Layout(props: RouteSectionProps) {
  return (
    <div class="min-h-screen bg-gray-50">
      <Sidebar />
      <div class="lg:pl-64">
        <Header />
        <main class="py-6">
          <div class="mx-auto max-w-7xl px-1 sm:px-6 lg:px-8">
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
