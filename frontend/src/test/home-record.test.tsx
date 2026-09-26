import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from './renderApp'

describe('Patient home', () => {
  it('summarizes the whole care journey', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /welcome back, maya/i })).toBeInTheDocument()
    expect(screen.getByText(/specialist appointment not scheduled after 9 days/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find better options/i })).toHaveAttribute('href', '/access?journey=jr-specialist&show=options')
    for (const h of [/active care/i, /upcoming/i, /active referrals/i, /recent health changes/i, /health trend/i]) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    }
  })

  it('shows longitudinal trends as flagged for review, never as a diagnosis', async () => {
    renderApp('/')
    const flag = await screen.findByRole('article', { name: /trend flag/i })
    expect(within(flag).getByText(/flagged for clinician review/i)).toBeInTheDocument()
    expect(within(flag).getByText(/6 encounters over 11 months/i)).toBeInTheDocument()
    expect(screen.queryByText(/diagnosed with/i)).not.toBeInTheDocument()
  })
})

describe('Unified health record', () => {
  it('shows every record section with a simulated-connection label', async () => {
    renderApp('/record')
    expect(await screen.findByRole('heading', { name: /^connected health records$/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/simulated record connection/i)).toBeInTheDocument()
    for (const section of [/^conditions/i, /^labs/i, /^visits/i, /^medications/i, /^imaging & procedures/i, /^referrals/i, /^care team/i, /record sources/i]) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument()
    }
    expect(screen.getByText(/ferritin re-checked at 8 ng\/ml/i)).toBeInTheDocument()
    expect(screen.getAllByText('Dr. Sarah Lindqvist').length).toBeGreaterThan(0)
  })
})
