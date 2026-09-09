import { installLocalStorageProxy } from '@genshin-optimizer/common/database'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'

installLocalStorageProxy()

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
