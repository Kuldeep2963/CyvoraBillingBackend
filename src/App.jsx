import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChakraProvider, Box } from '@chakra-ui/react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CDRUpload from './pages/CDRUpload';
import Customers from './pages/Accounts';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import Report from './pages/Reports';

function App() {

  
  return (
    <ChakraProvider>
      <Router>
        <Layout>
          <Box p={4}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<CDRUpload />} />
              <Route path="/accounts" element={<Customers />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/reports" element={<Report />} />
            </Routes>
          </Box>
        </Layout>
      </Router>
    </ChakraProvider>
  );
}

export default App;