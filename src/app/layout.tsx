import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from '../components/Auth';
import { AuthProvider, useAuth } from '../lib/auth';
import { Home } from './page';

// Lazy load heavy components
const Dashboard = React.lazy(() => import('./dashboard/page').then(m => ({ default: m.Dashboard })));
const EventBuilder = React.lazy(() => import('./events/[id]/edit/page').then(m => ({ default: m.EventBuilder })));
const PublicEvent = React.lazy(() => import('./e/[id]/page').then(m => ({ default: m.PublicEvent })));
const EventResponses = React.lazy(() => import('./events/[id]/responses/page').then(m => ({ default: m.EventResponses })));

// --- LOADING SHIM ---
const PageLoader = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
);

// --- ROUTES ---
const PrivateRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/auth" />;
};

const RootLayout = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <React.Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/e/:id" element={<PublicEvent />} />
            <Route path="/events/:id" element={<PublicEvent />} />

            {/* Protected Organizer Routes */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/events/:id/edit" element={<PrivateRoute><EventBuilder /></PrivateRoute>} />
            <Route path="/forms/:id/edit" element={<PrivateRoute><EventBuilder /></PrivateRoute>} />
            <Route path="/events/:id/responses" element={<PrivateRoute><EventResponses /></PrivateRoute>} />

            {/* New Standard Public Routes */}
            <Route path="/forms/:id/view" element={<PublicEvent />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default RootLayout;