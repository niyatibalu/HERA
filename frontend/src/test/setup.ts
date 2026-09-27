import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetDemoState } from '../api/client'
import { setSession } from '../lib/auth'

afterEach(() => {
  cleanup()
  resetDemoState()
  setSession(null)
})
