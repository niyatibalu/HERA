import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './renderApp'

describe('Care access and care journey', () => {
  it('shows the original referral’s barriers before offering alternatives', async () => {
    const user = userEvent.setup()
    renderApp('/access?journey=jr-specialist')
    const original = await screen.findByRole('article', { name: /original referral: dr\. renee whitfield/i })
    expect(within(original).getByText('61 days')).toBeInTheDocument()
    expect(within(original).getByText('122.3 mi')).toBeInTheDocument()
    expect(within(original).getByText('Out of network')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: /provider option/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /find better options/i }))
    const options = screen.getAllByRole('article', { name: /provider option/i })
    expect(options).toHaveLength(3)
    expect(within(options[1]).getByText('Kara Whitmore, DPT')).toBeInTheDocument()
    const best = options[0]
    for (const fact of ['12 days', '1.7 mi', 'In network', '$95', 'Available']) expect(within(best).getByText(fact)).toBeInTheDocument()
    expect(within(best).getByText(/why hera ranked this option/i)).toBeInTheDocument()
    expect(within(best).getByText(/49 days sooner/i)).toBeInTheDocument()
  })

  it('closes the loop: stalled referral → new provider → travel planned', async () => {
    const user = userEvent.setup()
    renderApp('/journey')

    const journey = await screen.findByRole('region', { name: /care journey: chronic pelvic pain/i })
    expect(within(journey).getByText(/stalled 9 days/i)).toBeInTheDocument()
    await user.click(within(journey).getByRole('link', { name: /find better options/i }))

    await user.click(await screen.findByRole('button', { name: /choose dr\. ifeoma okafor/i }))
    expect(await screen.findByText(/booked with dr\. ifeoma okafor on dec 29, 2025/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose dr\. michael chen/i })).toBeDisabled()

    await user.click(screen.getByRole('link', { name: /view care journey/i }))
    const updated = await screen.findByRole('region', { name: /care journey: chronic pelvic pain/i })
    expect(within(updated).queryByText(/stalled/i)).not.toBeInTheDocument()
    expect(within(updated).getByText('Dr. Ifeoma Okafor · Appointment Dec 29, 2025')).toBeInTheDocument()

    await user.click(within(updated).getByRole('radio', { name: /safer route/i }))
    await user.click(within(updated).getByRole('button', { name: /use safer route/i }))
    expect(await within(updated).findByText(/safer route selected/i)).toBeInTheDocument()
    expect(within(updated).queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('updates the home screen once the stalled referral is resolved', async () => {
    const user = userEvent.setup()
    renderApp('/access?journey=jr-specialist&show=options')
    await user.click(await screen.findByRole('button', { name: /choose dr\. ifeoma okafor/i }))
    await user.click(await screen.findByRole('link', { name: /overview/i }))
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.queryByText(/not scheduled after/i)).not.toBeInTheDocument()
    expect(screen.getByText(/plan travel/i)).toBeInTheDocument()
  })
})
