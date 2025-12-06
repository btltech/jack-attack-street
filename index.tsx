import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// This finds the <div> with id="root" in our index.html
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// This tells React to take control of that element and render our App
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);