import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './renderApp'

describe('Symptom log', () => {
  it('groups notes by visit, before and after', async () => {
    renderApp('/symptoms')
    expect(await screen.findByRole('heading', { name: /your notes, before and after visits/i })).toBeInTheDocument()
    const aug = screen.getByRole('heading', { name: 'OB/GYN · Dr. Sarah Lindqvist · Aug 15' }).closest('section')!
    expect(within(aug).getByText('1 before · 1 after')).toBeInTheDocument()
    expect(within(aug).getAllByRole('article')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: /general notes/i })).toBeInTheDocument()
  })

  it('logs a note before an upcoming visit and can delete it', async () => {
    const user = userEvent.setup()
    renderApp('/symptoms')
    const form = await screen.findByRole('form', { name: /log a symptom/i })
    await user.type(within(form).getByLabelText(/^symptom/i), 'Bloating')
    await user.type(within(form).getByLabelText(/^note/i), 'Worse after meals')
    expect(within(form).getByLabelText(/which visit/i)).toHaveValue('Chronic pelvic pain specialist evaluation (upcoming)')
    await user.click(within(form).getByRole('button', { name: /save note/i }))

    const group = (await screen.findByRole('heading', { name: 'Chronic pelvic pain specialist evaluation (upcoming)' })).closest('section')!
    const note = await within(group).findByRole('article', { name: /bloating, 5 out of 10, before visit/i })
    expect(within(note).getByText('Worse after meals')).toBeInTheDocument()
    await user.click(within(note).getByRole('button', { name: /delete note about bloating/i }))
    await waitFor(() => expect(screen.queryByText('Worse after meals')).not.toBeInTheDocument())
  })

  it('requires a symptom', async () => {
    const user = userEvent.setup()
    renderApp('/symptoms')
    const form = await screen.findByRole('form', { name: /log a symptom/i })
    await user.click(within(form).getByRole('button', { name: /save note/i }))
    expect(within(form).getByRole('alert')).toHaveTextContent(/add a symptom/i)
  })
})

describe('Care preferences', () => {
  it('shows saved preferences and ranks with them', async () => {
    renderApp('/access?journey=jr-specialist&show=options')
    const prefs = (await screen.findByRole('heading', { name: /your care preferences/i })).closest('section')!
    for (const t of [/up to \$150 per visit · needs financial assistance/i, /within 30 mi of madison, wi/i, /female clinician/i, /weekday afternoons, weekday evenings/i]) {
      expect(within(prefs).getByText(t)).toBeInTheDocument()
    }
    const best = screen.getAllByRole('article', { name: /provider option/i })[0]
    expect(within(best).getByText('Dr. Ifeoma Okafor')).toBeInTheDocument()
    expect(within(best).getByText(/matches your preference for a female clinician/i)).toBeInTheDocument()
    expect(within(best).getByText('★ 4.8')).toBeInTheDocument()
    expect(within(best).getByText(/sliding-scale fees/i, { selector: '.badge' })).toBeInTheDocument()
  })

  it('edits and saves preferences', async () => {
    const user = userEvent.setup()
    renderApp('/access?journey=jr-specialist')
    const prefs = (await screen.findByRole('heading', { name: /your care preferences/i })).closest('section')!
    await user.click(within(prefs).getByRole('button', { name: /edit preferences/i }))
    const form = within(prefs).getByRole('form', { name: /care preferences/i })
    await user.click(within(form).getByRole('radio', { name: /prefer telehealth/i }))
    await user.click(within(within(form).getByRole('group', { name: /clinician gender/i })).getByRole('radio', { name: /no preference/i }))
    await user.click(within(form).getByRole('checkbox', { name: /weekends/i }))
    await user.click(within(form).getByRole('button', { name: /save and re-rank/i }))
    expect(await within(prefs).findByText(/prefer telehealth/i)).toBeInTheDocument()
    expect(within(prefs).getByText(/no gender preference/i)).toBeInTheDocument()
    expect(within(prefs).getByText(/weekday afternoons, weekday evenings, weekends/i)).toBeInTheDocument()
  })
})
