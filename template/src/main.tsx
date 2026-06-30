import { StrictMode, createRoot, h } from './react';
import { HashRouter } from './router';
import App from './App';
import './styles/obsidian.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(
  h(StrictMode, null, h(HashRouter, null, h(App, null))),
);
