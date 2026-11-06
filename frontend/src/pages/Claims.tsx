import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Inbox, Phone, Send } from 'lucide-react'
import ClaimCard from '../components/ClaimCard'
import {
  EmptyState,
  LoadingState,
  NeoAlert,
  NeoLink,
  PageContainer,
  PageHeader,
  SectionTitle,
} from '../components/neo'
import { API_BASE, authHeaders } from '../lib/api'
import type { Claim } from '../lib/types'

export default function Claims() {
  const [mine, setMine] = useState<Claim[]>([])
  const [received, setReceived] = useState<Claim[]>([])
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadClaims()
  }, [token, navigate])

  const loadClaims = async () => {
    setError('')
    try {
      const headers = authHeaders(token)
      const [mineResponse, receivedResponse] = await Promise.all([
        fetch(`${API_BASE}/claims/mine`, { headers }),
        fetch(`${API_BASE}/claims/received`, { headers }),
      ])

      if (mineResponse.status === 401 || receivedResponse.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      if (!mineResponse.ok || !receivedResponse.ok) {
        throw new Error('Failed to load claims')
      }

      setMine(await mineResponse.json())
      setReceived(await receivedResponse.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims')
    } finally {
      setLoading(false)
    }
  }

  const reviewClaim = async (claimId: string, action: 'accept' | 'reject') => {
    setError('')
    setSuccessMessage('')
    setReviewingId(claimId)
    try {
      const response = await fetch(`${API_BASE}/claims/${claimId}/${action}`, {
        method: 'POST',
        headers: authHeaders(token),
      })
      if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || `Failed to ${action} claim`)
      }
      setSuccessMessage(
        action === 'accept'
          ? 'Claim accepted. Contact details are now visible to both people.'
          : 'Claim rejected.',
      )
      await loadClaims()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} claim`)
    } finally {
      setReviewingId(null)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState label="Loading claims..." />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="py-10 sm:py-12">
      <PageHeader
        icon={<CheckCircle2 className="h-6 w-6" aria-hidden="true" />}
        eyebrow="Ownership workflow"
        title="Claims"
        subtitle="Review claims you sent and decide on claims made against your found reports."
        actions={
          <NeoLink to="/matches" variant="lavender">
            <Send className="h-4 w-4" aria-hidden="true" />
            Find a match
          </NeoLink>
        }
      />

      <NeoAlert tone="info" className="mb-6">
        <div className="flex items-start gap-2">
          <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Mobile numbers are hidden until a claim is accepted, and are then visible only to
            the claimant and the found-report owner.
          </p>
        </div>
      </NeoAlert>

      {successMessage && (
        <NeoAlert tone="success" className="mb-6">
          {successMessage}
        </NeoAlert>
      )}

      {error && (
        <NeoAlert tone="error" className="mb-6">
          {error}
        </NeoAlert>
      )}

      <section>
        <SectionTitle
          title="Claims I submitted"
          description={`${mine.length} claim${mine.length === 1 ? '' : 's'} sent on found reports.`}
        />
        {mine.length === 0 ? (
          <EmptyState
            icon={<Send className="h-7 w-7" aria-hidden="true" />}
            title="No claims submitted"
            description="When a match looks like your item, open the match and send a verification message."
            action={
              <NeoLink to="/matches" variant="lime">
                Review matches
              </NeoLink>
            }
          />
        ) : (
          <div className="grid gap-4">
            {mine.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} received={false} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle
          title="Claims on my found reports"
          description={`${received.length} claim${
            received.length === 1 ? '' : 's'
          } awaiting or completed review.`}
        />
        {received.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-7 w-7" aria-hidden="true" />}
            title="No incoming claims"
            description="No one has claimed your found reports yet. Accepted claims will reveal contact details here."
            action={
              <NeoLink to="/report/new?type=FOUND" variant="lime">
                Report a found item
              </NeoLink>
            }
          />
        ) : (
          <div className="grid gap-4">
            {received.map((claim) => (
              <div key={claim.id} className={reviewingId === claim.id ? 'opacity-60' : ''}>
                <ClaimCard claim={claim} received onReview={reviewClaim} />
              </div>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  )
}
