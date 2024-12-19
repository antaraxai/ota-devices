import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';

// Protected Route wrapper component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <DeviceProvider>
        <NotificationProvider>
          <ToastContainer />
          <Router>
            <Routes>
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/auth" element={<Auth />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </DeviceProvider>
    </AuthProvider>
  );
}

export default App;