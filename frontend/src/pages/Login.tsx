import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, LogIn, Mail } from 'lucide-react'
import { API_BASE } from '../lib/api'
import {
  NeoAlert,
  NeoButton,
  NeoCard,
  NeoInput,
  PageContainer,
} from '../components/neo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('username', email)
      formData.append('password', password)

      const response = await fetch(`${API_BASE}/auth/token`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || 'Invalid email or password')
      }

      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user_id', data.id || '')
      localStorage.setItem('email', data.email || email)
      localStorage.setItem('mobile_number', data.mobile_number || '')
      localStorage.setItem('is_superuser', String(Boolean(data.is_superuser)))
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer size="auth" className="py-10 sm:py-16">
      <div className="relative">
        <div className="pointer-events-none absolute -left-6 -top-6 h-16 w-16 rotate-12 border-[3px] border-ink bg-bubble shadow-[4px_4px_0_#111111]" />
        <div className="pointer-events-none absolute -bottom-5 -right-5 h-20 w-20 rounded-full border-[3px] border-ink bg-lavender" />

        <NeoCard className="relative overflow-hidden shadow-neo-lime">
          <div className="border-b-[3px] border-ink bg-lavender-soft px-6 py-5 sm:px-8">
            <span className="neo-icon-box">
              <LogIn className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-ink">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">
              Log in to manage reports, matches, and claims.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <NeoAlert tone="error" className="mb-5">
                {error}
              </NeoAlert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <NeoInput
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                required
              />
              <NeoInput
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                required
              />
              <NeoButton type="submit" variant="lime" size="lg" loading={loading} className="w-full">
                Login
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </NeoButton>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="neo-link">
                Register
              </Link>
            </p>
          </div>
        </NeoCard>
      </div>
    </PageContainer>
  )
}
