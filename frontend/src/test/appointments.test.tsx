import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RouteOptions } from '../components/RouteOptions'
import { renderApp } from './renderApp'

async function bookOkafor(user: ReturnType<typeof userEvent.setup>) {
  renderApp('/access?journey=jr-specialist&show=options')
  await user.click(await screen.findByRole('button', { name: /choose dr\. ifeoma okafor/i }, { timeout: 3000 }))
  await user.click(await screen.findByRole('radio', { name: 'Mon, Dec 29 at 5:30 PM' }))
  await user.click(screen.getByRole('button', { name: /book mon, dec 29 at 5:30 pm/i }))
  await screen.findByText(/you're booked/i)
}

describe('Appointments', () => {
  it('shows the booked appointment and cancels it with a reason', async () => {
    const user = userEvent.setup()
    await bookOkafor(user)
    await user.click(screen.getByRole('link', { name: /view appointment/i }))
    const appt = await screen.findByRole('article', { name: /appointment with dr\. ifeoma okafor on mon, dec 29 at 5:30 pm/i })
    expect(within(appt).getByText('In person')).toBeInTheDocument()
    expect(within(appt).getByText('Madison, WI')).toBeInTheDocument()

    await user.click(within(appt).getByRole('button', { name: /cancel appointment/i }))
    const confirm = within(appt).getByRole('group', { name: /confirm cancellation/i })
    await user.selectOptions(within(confirm).getByLabelText(/reason/i), 'Schedule conflict')
    await user.click(within(confirm).getByRole('button', { name: /yes, cancel appointment/i }))

    expect(await screen.findByText(/appointment with dr\. ifeoma okafor cancelled/i)).toBeInTheDocument()
    expect(screen.getByText(/no upcoming appointments/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /find a new time/i })).toHaveAttribute('href', '/access?journey=jr-specialist&show=options')
  })

  it('keeps the appointment when you back out', async () => {
    const user = userEvent.setup()
    await bookOkafor(user)
    await user.click(screen.getByRole('link', { name: /view appointment/i }))
    const appt = await screen.findByRole('article', { name: /appointment with dr\. ifeoma okafor/i })
    await user.click(within(appt).getByRole('button', { name: /cancel appointment/i }))
    await user.click(within(appt).getByRole('button', { name: /keep appointment/i }))
    expect(within(appt).queryByRole('group', { name: /confirm cancellation/i })).not.toBeInTheDocument()
  })

  it('reschedules: cancels, then reopens the same provider’s scheduler to book a new time', async () => {
    const user = userEvent.setup()
    await bookOkafor(user)
    await user.click(screen.getByRole('link', { name: /view appointment/i }))
    await user.click(await screen.findByRole('button', { name: /reschedule/i }))
    const scheduler = await screen.findByRole('region', { name: /book with dr\. ifeoma okafor/i }, { timeout: 3000 })
    await user.click(within(scheduler).getByRole('radio', { name: 'Tue, Dec 30 at 1:30 PM' }))
    await user.click(within(scheduler).getByRole('button', { name: /book tue, dec 30 at 1:30 pm/i }))
    await waitFor(() => expect(screen.getByText(/tue, dec 30 at 1:30 pm · in person/i)).toBeInTheDocument(), { timeout: 3000 })
  })
})

describe('Pregnancy check on routes', () => {
  it('lists what matters for travel while pregnant, met or not', () => {
    render(
      <RouteOptions
        options={[{
          route_id: 'r1', mode: 'safer', label: 'Recommended for pregnancy', duration_minutes: 28, summary: 's', conditions: [], recommended: true,
          pregnancy_check: [{ label: 'Never more than 3 mi from a labor & delivery hospital', ok: true }, { label: 'Moderate winter-weather exposure', ok: false }],
        }]}
      />,
    )
    const check = screen.getByRole('list', { name: /pregnancy check/i })
    expect(within(check).getAllByRole('listitem')).toHaveLength(2)
    expect(within(check).getByText(/labor & delivery/i)).toBeInTheDocument()
  })
})
