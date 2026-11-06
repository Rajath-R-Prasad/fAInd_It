import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Search, Sparkles, Target } from 'lucide-react'
import MatchCard from '../components/MatchCard'
import {
  EmptyState,
  LoadingState,
  NeoAlert,
  NeoBadge,
  NeoButton,
  NeoLink,
  NeoTextarea,
  PageContainer,
  PageHeader,
} from '../components/neo'
import { API_BASE, authHeaders } from '../lib/api'
import { badgeToneForStatus } from '../lib/badges'
import type { MatchGroup } from '../lib/types'

export default function Matches() {
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [claimTarget, setClaimTarget] = useState<string | null>(null)
  const [claimMessage, setClaimMessage] = useState('')
  const [claimError, setClaimError] = useState('')
  const [claiming, setClaiming] = useState(false)
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadMatches()
  }, [token, navigate])

  const loadMatches = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/matches/`, {
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
        throw new Error(data.detail || 'Failed to load matches')
      }
      setMatchGroups(data.matches || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const submitClaim = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!claimTarget || !claimMessage.trim()) return
    setClaimError('')
    setSuccessMessage('')
    setClaiming(true)

    try {
      const response = await fetch(`${API_BASE}/claims`, {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          found_report_id: claimTarget,
          message: claimMessage.trim(),
        }),
      })
      if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to submit claim')
      }
      setClaimTarget(null)
      setClaimMessage('')
      setSuccessMessage('Claim submitted. The found-report owner can now review it.')
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Failed to submit claim')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState label="Ranking potential matches..." />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="py-10 sm:py-12">
      <PageHeader
        icon={<Target className="h-6 w-6" aria-hidden="true" />}
        eyebrow="AI matching"
        title="Potential Matches"
        subtitle="Compare your reports against opposite-type reports. Scores rank candidates; they do not prove ownership."
        actions={
          <NeoButton
            type="button"
            variant="white"
            loading={refreshing}
            onClick={() => loadMatches(true)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </NeoButton>
        }
      />

      <NeoAlert tone="warning" className="mb-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            AI suggestions are not proof of ownership. Similarity scores are ranking signals,
            not match probabilities. Verify the item before arranging its return.
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

      {matchGroups.length === 0 ? (
        <EmptyState
          icon={<Search className="h-7 w-7" aria-hidden="true" />}
          title="No matches to review yet"
          description="Create a lost or found report first. fAInd It compares each report with opposite-type reports."
          action={
            <NeoLink to="/report/new" variant="lime">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Create a report
            </NeoLink>
          }
        />
      ) : (
        <div className="space-y-10">
          {matchGroups.map((group, groupIndex) => {
            const source = group.source_report
            if (!source) return null
            return (
              <section key={group.source_report_id || source.id || groupIndex}>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted">
                      Matches for your report
                    </p>
                    <Link
                      to={`/reports/${source.id}`}
                      className="font-display text-2xl font-extrabold text-ink underline-offset-4 hover:underline"
                    >
                      {source.title}
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <NeoBadge tone={badgeToneForStatus(source.type)}>{source.type}</NeoBadge>
                    <NeoBadge tone={badgeToneForStatus(source.status)}>
                      {source.status || 'OPEN'}
                    </NeoBadge>
                  </div>
                </div>

                {group.matches.length === 0 ? (
                  <NeoAlert tone="info">
                    No opposite-type reports are available yet. Check back after more reports are
                    added.
                  </NeoAlert>
                ) : (
                  <div className="space-y-5">
                    {group.matches.map((match) => (
                      <MatchCard key={match.report_id || match.report.id} source={source} match={match}>
                        {match.can_claim && (
                          <div>
                            {claimTarget === match.report.id ? (
                              <form onSubmit={submitClaim} className="space-y-3">
                                <NeoTextarea
                                  label="Verification message"
                                  value={claimMessage}
                                  onChange={(event) => setClaimMessage(event.target.value)}
                                  rows={3}
                                  placeholder="Describe a detail that proves this item is yours."
                                  hint="Only the found-report owner sees this message."
                                  required
                                />
                                {claimError && <NeoAlert tone="error">{claimError}</NeoAlert>}
                                <div className="flex flex-wrap gap-2">
                                  <NeoButton
                                    type="submit"
                                    variant="lime"
                                    loading={claiming}
                                    disabled={!claimMessage.trim()}
                                  >
                                    Submit claim
                                  </NeoButton>
                                  <NeoButton
                                    type="button"
                                    variant="white"
                                    onClick={() => {
                                      setClaimTarget(null)
                                      setClaimMessage('')
                                      setClaimError('')
                                    }}
                                  >
                                    Cancel
                                  </NeoButton>
                                </div>
                              </form>
                            ) : (
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-semibold text-muted">
                                  Think this is yours? Send the found-report owner a verification
                                  message.
                                </p>
                                <NeoButton
                                  type="button"
                                  variant="lime"
                                  onClick={() => {
                                    setClaimTarget(match.report.id)
                                    setClaimMessage('')
                                    setClaimError('')
                                    setSuccessMessage('')
                                  }}
                                >
                                  Submit claim
                                </NeoButton>
                              </div>
                            )}
                          </div>
                        )}
                      </MatchCard>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
