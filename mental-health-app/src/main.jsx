import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DataCapture from './DataCapture.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* <DataCapture /> */}
  </StrictMode>,
)
