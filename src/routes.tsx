import { 
  createRootRoute, 
  createRoute, 
  createRouter, 
  Outlet 
} from '@tanstack/react-router';
import Home from './routes/index';
import HostRoom from './routes/host.$roomCode';
import PlayRoom from './routes/play.$roomCode';

// 1. Root route - wrap application with a container
const rootRoute = createRootRoute({
  component: () => (
    <div className="app-container">
      <Outlet />
    </div>
  ),
});

// 2. Child routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});

const hostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/host/$roomCode',
  component: HostRoom,
});

const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/$roomCode',
  component: PlayRoom,
});

// 3. Construct route tree
const routeTree = rootRoute.addChildren([indexRoute, hostRoute, playRoute]);

// 4. Create and export the router
export const router = createRouter({ routeTree });

// 5. Register type safety details for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
