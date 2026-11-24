import React from 'react';
import ReactDOM from 'react-dom/client';
import DiceApp from '../dice-app/DiceApp';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <DiceApp />
    </React.StrictMode>
  );
}
