import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChakraProvider, Box } from '@chakra-ui/react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CDRUpload from './pages/CDRUpload';
import CDRList from './pages/CDRList';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';

function App() {

  
  return (
    <ChakraProvider>
      <Router>
        <Layout>
          <Box p={4}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<CDRUpload />} />
              <Route path="/cdrs" element={<CDRList />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Box>
        </Layout>
      </Router>
    </ChakraProvider>
  );
}

export default App;