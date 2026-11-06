import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Search, X } from 'lucide-react'
import { cn } from '../lib/cn'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/report/new', label: 'Report Item' },
  { to: '/matches', label: 'Matches' },
  { to: '/claims', label: 'Claims' },
  { to: '/evaluation', label: 'Evaluation' },
]

function isActiveRoute(pathname: string, to: string) {
  if (to === '/dashboard') {
    return (
      pathname === '/dashboard' ||
      (pathname.startsWith('/reports/') &&
        pathname !== '/report/new' &&
        !pathname.endsWith('/edit'))
    )
  }
  if (to === '/report/new') {
    return pathname === '/report/new' || pathname.endsWith('/edit')
  }
  return pathname === to
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const token = localStorage.getItem('token')
  const isSuperuser = localStorage.getItem('is_superuser') === 'true'

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user_id')
    localStorage.removeItem('email')
    localStorage.removeItem('mobile_number')
    localStorage.removeItem('is_superuser')
    setOpen(false)
    navigate('/login')
  }

  const linkClass = (to: string) =>
    cn(
      'rounded-md border-[3px] border-transparent px-3 py-2 font-display text-xs font-extrabold uppercase tracking-[0.12em] transition-all duration-150',
      isActiveRoute(location.pathname, to)
        ? 'border-ink bg-lime text-ink shadow-[3px_3px_0_#111111]'
        : 'text-ink hover:border-ink hover:bg-white hover:shadow-[3px_3px_0_#111111]',
    )

  return (
    <nav className="sticky top-0 z-40 border-b-4 border-ink bg-lavender">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md border-[3px] border-ink bg-lime px-3 py-2 font-display text-xl font-extrabold tracking-tight text-ink shadow-neo-logo transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_#111111] sm:text-2xl"
        >
          <Search className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
          <span>fAInd It</span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {token ? (
            <>
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={linkClass(item.to)}
                  aria-current={isActiveRoute(location.pathname, item.to) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ))}
              {isSuperuser && (
                <Link
                  to="/admin"
                  className={linkClass('/admin')}
                  aria-current={isActiveRoute(location.pathname, '/admin') ? 'page' : undefined}
                >
                  Admin
                </Link>
              )}
              <button
                type="button"
                onClick={logout}
                className="ml-2 inline-flex items-center gap-2 rounded-md border-[3px] border-ink bg-bubble px-3 py-2 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink shadow-neo-btn transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#111111]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={linkClass('/login')}>
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-md border-[3px] border-ink bg-lime px-4 py-2 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink shadow-neo-btn transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#111111]"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border-[3px] border-ink bg-white text-ink shadow-neo-btn md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-navigation"
          className="border-t-4 border-ink bg-lavender-soft px-4 pb-4 pt-3 md:hidden"
        >
          <div className="mx-auto flex max-w-[1200px] flex-col gap-2">
            {token ? (
              <>
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(linkClass(item.to), 'block text-center')}
                    aria-current={
                      isActiveRoute(location.pathname, item.to) ? 'page' : undefined
                    }
                  >
                    {item.label}
                  </Link>
                ))}
                {isSuperuser && (
                  <Link
                    to="/admin"
                    className={cn(linkClass('/admin'), 'block text-center')}
                    aria-current={
                      isActiveRoute(location.pathname, '/admin') ? 'page' : undefined
                    }
                  >
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-md border-[3px] border-ink bg-bubble px-3 py-2 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink shadow-neo-btn"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={cn(linkClass('/login'), 'block text-center')}>
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block rounded-md border-[3px] border-ink bg-lime px-4 py-2 text-center font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink shadow-neo-btn"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
