import React from 'react';
import ReactDOM from 'react-dom/client';
import AyoApp from '../ayo-app/AyoApp';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AyoApp />
    </React.StrictMode>
  );
}
