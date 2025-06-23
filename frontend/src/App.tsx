import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Places } from './pages/Places';
import { Admin } from './pages/Admin';
import './index.css';

export default function App() {
  console.log('App component rendering');
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Home />} />
            <Route path="places" element={<Places />} />
            <Route path="admin" element={
              <ProtectedRoute requireAdmin>
                <Admin />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
} 