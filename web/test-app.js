// Simple test to check if React components can be imported
console.log('Testing imports...');

try {
  const React = require('react');
  console.log('✅ React imported successfully');
  
  const ReactDOM = require('react-dom/client');
  console.log('✅ ReactDOM imported successfully');
  
  const { BrowserRouter } = require('react-router-dom');
  console.log('✅ React Router imported successfully');
  
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  console.log('✅ React Query imported successfully');
  
  console.log('✅ All core dependencies are working!');
} catch (error) {
  console.error('❌ Import error:', error.message);
}