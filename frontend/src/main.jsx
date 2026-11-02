import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import { store } from './redux/store'
import { unlockAlerts } from './lib/alerts'

// Sound and the notification prompt are only allowed after a click
window.addEventListener('pointerdown', unlockAlerts, { once: true })

createRoot(document.getElementById('root')).render(
<Provider store={store}>
    <App />
    <Toaster position="top-right" richColors closeButton />
 </Provider>
)
