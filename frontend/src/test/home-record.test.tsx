import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './renderApp'

describe('Patient home', () => {
  it('leads with one priority, then the journey, insights, upcoming care and symptoms', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /good (morning|afternoon|evening), maya/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/1 thing needs your attention/i)).toBeInTheDocument()
    const priority = screen.getByRole('heading', { name: /specialist referral stalled/i }).closest('section')!
    expect(within(priority).getByText(/no appointment booked after 9 days/i)).toBeInTheDocument()
    expect(within(priority).getByRole('link', { name: /find better options/i })).toHaveAttribute('href', '/access?journey=jr-specialist&show=options')
    for (const h of [/chronic pelvic pain care journey/i, /upcoming care/i, /^symptoms$/i]) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    }
    expect(screen.getByText(/3 of 7 steps complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /health trend|noticed a pattern/i })).not.toBeInTheDocument()
  })

  it('prompts to connect MyChart and summarizes symptoms', async () => {
    renderApp('/')
    const connect = (await screen.findByRole('heading', { name: /bring your records together/i })).closest('article')!
    expect(within(connect).getByRole('link', { name: /connect mychart/i })).toHaveAttribute('href', '/record')
    const symptoms = screen.getByRole('heading', { name: /^symptoms$/i }).closest('section')!
    for (const name of ['Fatigue', 'Pelvic pain', 'Heavy bleeding']) expect(within(symptoms).getByText(name)).toBeInTheDocument()
    expect(within(symptoms).getAllByRole('listitem')).toHaveLength(3)
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
