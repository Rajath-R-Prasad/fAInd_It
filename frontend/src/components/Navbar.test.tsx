import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from './Navbar'

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  )
}

describe('Navbar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the evaluation link for signed-in users', () => {
    localStorage.setItem('token', 'test-token')
    renderNavbar()

    expect(screen.getByRole('link', { name: 'Evaluation' })).toBeInTheDocument()
  })

  it('hides the admin link for non-superusers', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('is_superuser', 'false')
    renderNavbar()

    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('shows the admin link for superusers', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('is_superuser', 'true')
    renderNavbar()

    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })
})
