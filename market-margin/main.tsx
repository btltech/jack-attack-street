import { createRoot } from 'react-dom/client';
import { MarketApp } from '../market-app/MarketApp';
import '../market-app/market.css';

createRoot(document.getElementById('root')!).render(<MarketApp />);
