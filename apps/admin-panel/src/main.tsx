import React from 'react'
import ReactDOM from 'react-dom/client'
import WebApp from './telegram'
import { initializeTelegramViewport } from './telegram-viewport'
import App from './App.tsx'
import './index.css'

initializeTelegramViewport(WebApp)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
