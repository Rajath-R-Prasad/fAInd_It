import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, Mail, Phone, UserPlus } from 'lucide-react'
import { API_BASE } from '../lib/api'
import {
  NeoAlert,
  NeoButton,
  NeoCard,
  NeoInput,
  PageContainer,
} from '../components/neo'

export default function Register() {
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    const digits = mobileNumber.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) {
      setError('Enter a valid mobile number with 7 to 15 digits.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email,
          password,
          mobile_number: mobileNumber,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed')
      }

      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer size="auth" className="py-10 sm:py-16">
      <div className="relative">
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 -rotate-12 border-[3px] border-ink bg-lime shadow-[4px_4px_0_#111111]" />
        <div className="pointer-events-none absolute -bottom-6 -left-5 h-16 w-16 rounded-full border-[3px] border-ink bg-bubble" />

        <NeoCard className="relative overflow-hidden shadow-neo-lime">
          <div className="border-b-[3px] border-ink bg-lavender-soft px-6 py-5 sm:px-8">
            <span className="neo-icon-box">
              <UserPlus className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-ink">Create account</h1>
            <p className="mt-1 text-sm text-muted">
              Your mobile number stays private until a claim is accepted.
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
                label="Mobile number"
                type="tel"
                name="mobile_number"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                icon={<Phone className="h-4 w-4" aria-hidden="true" />}
                hint="Shared only with the other person after an accepted claim."
                required
              />
              <NeoInput
                label="Password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                hint="Use at least 8 characters."
                required
              />
              <NeoButton type="submit" variant="lime" size="lg" loading={loading} className="w-full">
                Register
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </NeoButton>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              Already have an account?{' '}
              <Link to="/login" className="neo-link">
                Login
              </Link>
            </p>
          </div>
        </NeoCard>
      </div>
    </PageContainer>
  )
}
