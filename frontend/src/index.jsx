import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { ChakraProvider } from '@chakra-ui/react';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
 <ChakraProvider theme={theme} toastOptions={{ defaultOptions: { position: "top-right" } }}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ChakraProvider>
);