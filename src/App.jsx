import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { ChakraProvider, Box } from '@chakra-ui/react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CDRUpload from './pages/CDRUpload';
import Customers from './pages/Accounts';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import Report from './pages/Reports';
import LoginPage from './pages/LoginPage';

const AppLayout = () => (
  <Layout>
    <Box p={4}>
      <Outlet />
    </Box>
  </Layout>
);

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<CDRUpload />} />
            <Route path="/accounts" element={<Customers />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reports" element={<Report />} />
          </Route>
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;