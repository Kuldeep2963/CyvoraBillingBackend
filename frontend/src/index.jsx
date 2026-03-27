import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import { ChakraProvider } from '@chakra-ui/react';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import { initializeSentry } from './sentry';

initializeSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Sentry.ErrorBoundary fallback={<h1>Something went wrong.</h1>}>
    <ChakraProvider theme={theme} toastOptions={{ defaultOptions: { position: 'top-right' } }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ChakraProvider>
  </Sentry.ErrorBoundary>
);
