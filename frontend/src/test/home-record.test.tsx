import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from './renderApp'

describe('Patient home', () => {
  it('summarizes the whole care journey', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /welcome back, amara/i })).toBeInTheDocument()
    expect(screen.getByText(/pelvic ultrasound not yet scheduled/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /active care/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /upcoming/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /active referrals/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /recent health changes/i })).toBeInTheDocument()
  })

  it('shows longitudinal trends as flagged for review, never as a diagnosis', async () => {
    renderApp('/')
    const flag = await screen.findByRole('article', { name: /trend flag/i })
    expect(within(flag).getByText(/flagged for clinician review/i)).toBeInTheDocument()
    expect(within(flag).getByText(/5 encounters with 3 different clinicians over 11 months/i)).toBeInTheDocument()
    expect(screen.queryByText(/diagnosis:/i)).not.toBeInTheDocument()
  })
})

describe('Unified health record', () => {
  it('shows every record section with a simulated-connection label', async () => {
    renderApp('/record')
    expect(await screen.findByRole('heading', { name: /^connected health records$/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/simulated record connection/i)).toBeInTheDocument()
    for (const section of ['Diagnoses', 'Recent labs', 'Visits', 'Medications', 'Imaging', 'Referrals', /specialists & procedures/i]) {
      expect(screen.getByRole('heading', { name: section instanceof RegExp ? section : new RegExp(`^${section}`) })).toBeInTheDocument()
    }
    expect(screen.getByText('Ferritin')).toBeInTheDocument()
    expect(screen.getAllByText(/not yet scheduled/i).length).toBeGreaterThan(0)
  })
})
