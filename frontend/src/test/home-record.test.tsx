import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './renderApp'

describe('Patient home', () => {
  it('summarizes the whole care journey', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /welcome back, maya/i })).toBeInTheDocument()
    expect(screen.getByText(/specialist appointment not scheduled after 9 days/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find better options/i })).toHaveAttribute('href', '/access?journey=jr-specialist&show=options')
    for (const h of [/active care/i, /upcoming/i, /active referrals/i, /recent health changes/i, /symptom notes/i]) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    }
    expect(screen.queryByRole('heading', { name: /health trend/i })).not.toBeInTheDocument()
  })

  it('prompts to connect MyChart and shows the latest symptom notes', async () => {
    renderApp('/')
    const hero = (await screen.findByRole('heading', { name: /welcome back, maya/i })).closest('section')!
    expect(within(hero).getByText(/mychart not connected/i)).toBeInTheDocument()
    expect(within(hero).getByRole('link', { name: /connect mychart/i })).toHaveAttribute('href', '/record')
    const notes = screen.getByRole('heading', { name: /^symptom notes/i }).closest('section')!
    expect(within(notes).getByText(/fatigue/i)).toBeInTheDocument()
  })
})

describe('Unified health record', () => {
  it('asks to connect MyChart first, then shows every record section', async () => {
    const user = userEvent.setup()
    renderApp('/record')
    expect(await screen.findByRole('heading', { name: /connect your mychart/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^labs/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^connect mychart$/i }))
    expect(screen.getByText(/lab results/i)).toBeInTheDocument()
    expect(screen.getByText(/signing in is simulated/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /allow and connect/i }))

    expect(await screen.findByRole('heading', { name: /mychart connected/i }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText(/20 records imported/i)).toBeInTheDocument()
    expect(screen.getByText(/simulated record connection/i)).toBeInTheDocument()
    for (const section of [/^conditions/i, /^labs/i, /^visits/i, /^medications/i, /^imaging & procedures/i, /^referrals/i, /^care team/i, /record sources/i]) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument()
    }
    expect(screen.getByText(/ferritin re-checked at 8 ng\/ml/i)).toBeInTheDocument()
  })
})
