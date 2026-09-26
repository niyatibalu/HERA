import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './renderApp'

describe('Research consent', () => {
  it('asks first, explains the terms, and shows no studies before consent', async () => {
    renderApp('/research')
    expect(await screen.findByText(/would you like to allow/i)).toBeInTheDocument()
    expect(screen.getByText(/completely optional/i)).toBeInTheDocument()
    expect(screen.getByText(/researchers never see who you are/i)).toBeInTheDocument()
    expect(screen.getByText(/joining a study is a separate decision/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, i’m interested/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: /study:/i })).not.toBeInTheDocument()
  })

  it('“Not now” shares nothing and can be changed later', async () => {
    const user = userEvent.setup()
    renderApp('/research')
    await user.click(await screen.findByRole('button', { name: /not now/i }))
    expect(await screen.findByText(/research matching is off/i)).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: /study:/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /yes, i’m interested/i })).toBeInTheDocument()
  })

  it('after consent, shows potential study matches without enrolling', async () => {
    const user = userEvent.setup()
    renderApp('/research')
    await user.click(await screen.findByRole('button', { name: /yes, i’m interested/i }))
    const study = await screen.findByRole('article', { name: /study: chronic pelvic pain/i })
    expect(within(study).getByText(/potential match based on/i)).toBeInTheDocument()
    expect(within(study).getByText(/age range 18–35/i)).toBeInTheDocument()
    expect(screen.getByText(/you have not been enrolled/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enroll|join/i })).not.toBeInTheDocument()

    await user.click(within(study).getByRole('button', { name: /learn more/i }))
    expect(within(study).getByText(/nothing happens automatically/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /turn off research matching/i }))
    expect(await screen.findByText(/research matching is off/i)).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: /study:/i })).not.toBeInTheDocument()
  })
})
