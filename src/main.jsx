import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SiteRouter from './router.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><SiteRouter /></AppErrorBoundary>
  </StrictMode>,
)
