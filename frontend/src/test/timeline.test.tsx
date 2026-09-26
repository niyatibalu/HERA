import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './renderApp'

describe('Longitudinal health timeline', () => {
  it('lists every flag as a pattern for clinician review, not a diagnosis', async () => {
    renderApp('/timeline')
    const flags = await screen.findAllByRole('article', { name: /trend flag/i })
    expect(flags).toHaveLength(5)
    for (const f of flags) expect(within(f).getByText(/flagged for clinician review/i)).toBeInTheDocument()
    expect(screen.getByText(/not diagnoses/i)).toBeInTheDocument()
  })

  it('shows events chronologically, grouped by month', async () => {
    renderApp('/timeline')
    const timeline = await screen.findByRole('list', { name: /health timeline/i })
    const months = within(timeline).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(months[0]).toBe('Jan 2025')
    expect(months[months.length - 1]).toBe('Dec 2025')
  })

  it('highlights the source records behind a flag', async () => {
    const user = userEvent.setup()
    const { container } = renderApp('/timeline')
    const flag = await screen.findByRole('article', { name: /pelvic pain increasing/i })
    await user.click(within(flag).getByRole('button', { name: /show 5 source records/i }))
    expect(within(flag).getByText(/source records/i)).toBeInTheDocument()
    expect(container.querySelector('#event-ev-010')).toHaveClass('is-lit')
    expect(container.querySelector('#event-ev-006')).toHaveClass('is-dim')
  })

  it('filters by event type', async () => {
    const user = userEvent.setup()
    renderApp('/timeline')
    await user.click(await screen.findByRole('button', { name: /^labs/i }))
    const timeline = screen.getByRole('list', { name: /health timeline/i })
    expect(within(timeline).getAllByText(/ferritin/i)).toHaveLength(2)
    expect(within(timeline).queryByText(/primary care visit/i)).not.toBeInTheDocument()
  })
})
