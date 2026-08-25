import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'ux4g-web-components/styles.css'
import 'ux4g-web-components/design-system'
import './styles/app.css'
import './styles/app-shell.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
