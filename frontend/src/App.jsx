import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CDRUpload from './pages/CDRUpload';
import Customers from './pages/Accounts';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import Disputes from './pages/Disputes';
import Settings from './pages/Settings';
import Report from './pages/Reports';
import LoginPage from './pages/LoginPage';
import SOAPage from './pages/SOA';
import AddUser from './pages/AddUser';
import Vendorinvoice from './pages/Vendorinvoice';
import AdminCDRDownload from './pages/AdminCDRDownload';
import ProtectedRoute from './components/ProtectedRoute';
import Unauthorized from './pages/Unauthorized';
import { useAuth } from './context/AuthContext';
import AccountExposure from './pages/AccountExposure';

const AppLayout = () => (
  <ProtectedRoute allowedRoles={["admin", "sales-manager", "rates-dept", "noc-dept", "view only"]}>
    <Layout>
      <Box>
        <Outlet />
      </Box>
    </Layout>
  </ProtectedRoute>
);

const LoginRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LoginRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected routes */}
        <Route element={<AppLayout />}>

            {/* All roles */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={["admin", "sales-manager", "rates-dept", "noc-dept", "view only"]}>
                <Dashboard />
              </ProtectedRoute>
            } />

            {/* All roles */}
            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={["admin", "sales-manager", "rates-dept", "noc-dept", "view only"]}>
                <Report />
              </ProtectedRoute>
            } />

            {/* admin, sales-manager, rates-dept, view only */}
            <Route path="/accounts" element={
              <ProtectedRoute allowedRoles={["admin", "sales-manager", "rates-dept", "view only"]}>
                <Customers />
              </ProtectedRoute>
            } />

            {/* admin, sales-manager, view only */}
            <Route path="/invoices" element={
              <ProtectedRoute allowedRoles={["admin", "sales-manager","rates-dept","view only"]}>
                <Invoices />
              </ProtectedRoute>
            } />

            {/* admin, sales-manager, view only */}
            <Route path="/soa" element={
              <ProtectedRoute allowedRoles={["admin", "sales-manager", "view only"]}>
                <SOAPage />
              </ProtectedRoute>
            } />

            {/* admin, rates-dept, view only */}
            <Route path="/vendorinvoice" element={
              <ProtectedRoute allowedRoles={["admin","sales-manager", "rates-dept", "view only"]}>
                <Vendorinvoice />
              </ProtectedRoute>
            } />

            {/* admin, sales-manager, rates-dept, view only */}
            <Route path="/payments" element={
              <ProtectedRoute allowedRoles={["admin", "sales-manager", "rates-dept", "view only"]}>
                <Payments />
              </ProtectedRoute>
            } />

            {/* admin, sales-manager, noc-dept, view only */}
            <Route path="/disputes" element={
              <ProtectedRoute allowedRoles={["admin", "sales-manager", "noc-dept", "view only"]}>
                <Disputes />
              </ProtectedRoute>
            } />

            {/* admin only */}
            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Settings />
              </ProtectedRoute>
            } />

            {/* admin only */}
            <Route path="/adduser" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AddUser />
              </ProtectedRoute>
            } />

            {/* admin only */}
            <Route path="/admin-cdr-download" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminCDRDownload />
              </ProtectedRoute>
            } />
            <Route path="/account-exposure" element={
              <ProtectedRoute allowedRoles={["admin","rates-dept", "view only"]}>
                <AccountExposure />
              </ProtectedRoute>
            } />

        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;