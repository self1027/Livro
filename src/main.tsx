import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import 'bootstrap/dist/css/bootstrap.min.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'

import App from './App'
import { runSeed } from './seed'

const STORAGE_KEYS = [
  '@visa-andradina:usuarios',
  '@visa-andradina:denuncias',
  '@visa-andradina:reports'
];

const hasData = STORAGE_KEYS.every(key => localStorage.getItem(key) !== null);

if (!hasData) {
  runSeed();
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)