import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { setSession } from '../lib/auth'

/** Renders the app at `path`, signed in as the demo patient unless `signedIn: false`. */
export function renderApp(path = '/', { signedIn = true } = {}) {
  setSession(signedIn ? { token: 'test', email: 'maya@example.com', patient_id: 'maya-001', name: 'Maya Restrepo' } : null)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}
