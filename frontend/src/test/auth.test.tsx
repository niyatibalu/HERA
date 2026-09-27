import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { currentSession } from '../lib/auth'
import { renderApp } from './renderApp'

describe('Sign in', () => {
  it('sends signed-out visitors to sign in, then back where they were going', async () => {
    const user = userEvent.setup()
    renderApp('/timeline', { signedIn: false })
    expect(await screen.findByRole('heading', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main/i })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/email/i), 'maya@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'HeraDemo2025!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByRole('heading', { name: /your visits and notes/i })).toBeInTheDocument()
    expect(currentSession()?.patient_id).toBe('maya-001')
  })

  it('rejects a wrong password', async () => {
    const user = userEvent.setup()
    renderApp('/', { signedIn: false })
    await user.type(await screen.findByLabelText(/email/i), 'maya@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'nope')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/email or password is incorrect/i)
    expect(currentSession()).toBeNull()
  })

  it('fills Maya’s account and signs out again', async () => {
    const user = userEvent.setup()
    renderApp('/', { signedIn: false })
    await user.click(await screen.findByRole('button', { name: /use this account/i }))
    expect(screen.getByLabelText(/email/i)).toHaveValue('maya@example.com')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    await user.click(await screen.findByRole('button', { name: /sign out/i }))
    expect(await screen.findByRole('heading', { name: /^sign in$/i })).toBeInTheDocument()
    expect(currentSession()).toBeNull()
  })
})
