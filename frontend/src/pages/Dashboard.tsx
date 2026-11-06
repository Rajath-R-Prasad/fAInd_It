import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Inbox,
  Plus,
  Search,
  Send,
  Sparkles,
  Target,
} from 'lucide-react'
import MatchCard from '../components/MatchCard'
import ReportCard from '../components/ReportCard'
import {
  EmptyState,
  LoadingState,
  NeoAlert,
  NeoLink,
  PageContainer,
  PageHeader,
  SectionTitle,
  StatCard,
} from '../components/neo'
import { API_BASE, authHeaders } from '../lib/api'
import type { Claim, MatchGroup, Report } from '../lib/types'

export default function Dashboard() {
  const [reports, setReports] = useState<Report[]>([])
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([])
  const [mineClaims, setMineClaims] = useState<Claim[]>([])
  const [receivedClaims, setReceivedClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadDashboard()
  }, [token, navigate])

  const loadDashboard = async () => {
    setError('')
    try {
      const headers = authHeaders(token)
      const [reportsResponse, matchesResponse, mineResponse, receivedResponse] =
        await Promise.all([
          fetch(`${API_BASE}/reports/`, { headers }),
          fetch(`${API_BASE}/matches/`, { method: 'POST', headers }),
          fetch(`${API_BASE}/claims/mine`, { headers }),
          fetch(`${API_BASE}/claims/received`, { headers }),
        ])

      if (
        reportsResponse.status === 401 ||
        matchesResponse.status === 401 ||
        mineResponse.status === 401 ||
        receivedResponse.status === 401
      ) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }

      if (!reportsResponse.ok) throw new Error('Failed to load your reports')
      setReports(await reportsResponse.json())

      if (matchesResponse.ok) {
        const matchData = await matchesResponse.json()
        setMatchGroups(matchData.matches || [])
      }
      if (mineResponse.ok) setMineClaims(await mineResponse.json())
      if (receivedResponse.ok) setReceivedClaims(await receivedResponse.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const deleteReport = async (reportId: string) => {
    if (!window.confirm('Delete this report? This cannot be undone from the UI.')) return
    setError('')
    try {
      const response = await fetch(`${API_BASE}/reports/${reportId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Could not delete report')
      }
      setReports((current) => current.filter((report) => report.id !== reportId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete report')
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState label="Loading your dashboard..." />
      </PageContainer>
    )
  }

  const matchCount = matchGroups.reduce((total, group) => total + (group.matches?.length || 0), 0)
  const pendingReceived = receivedClaims.filter((claim) => claim.status === 'PENDING').length
  const recentReports = [...reports]
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })
    .slice(0, 4)
  const featuredGroup = matchGroups.find((group) => group.matches?.length)
  const featuredMatch = featuredGroup?.matches?.[0]

  return (
    <PageContainer className="py-10 sm:py-12">
      <PageHeader
        icon={<FileText className="h-6 w-6" aria-hidden="true" />}
        eyebrow="Your workspace"
        title="Dashboard"
        subtitle="Track your reports, review potential matches, and manage claims from one place."
        actions={
          <>
            <NeoLink to="/report/new?type=LOST" variant="white">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Lost item
            </NeoLink>
            <NeoLink to="/report/new?type=FOUND" variant="lime">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Found item
            </NeoLink>
          </>
        }
      />

      {error && (
        <NeoAlert tone="error" className="mb-6">
          {error}
        </NeoAlert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My reports"
          value={reports.length}
          tone="lavender"
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          hint={`${reports.filter((report) => report.type === 'LOST').length} lost · ${
            reports.filter((report) => report.type === 'FOUND').length
          } found`}
        />
        <StatCard
          label="Potential matches"
          value={matchCount}
          tone="lime"
          icon={<Target className="h-5 w-5" aria-hidden="true" />}
          hint="Ranking signals from opposite-type reports"
        />
        <StatCard
          label="Claims submitted"
          value={mineClaims.length}
          tone="white"
          icon={<Send className="h-5 w-5" aria-hidden="true" />}
          hint="Claims you have sent on found items"
        />
        <StatCard
          label="Pending review"
          value={pendingReceived}
          tone="pink"
          icon={<Inbox className="h-5 w-5" aria-hidden="true" />}
          hint="Claims waiting for your decision"
        />
      </section>

      <section className="mt-8">
        <SectionTitle
          title="Quick actions"
          description="Jump straight into the most common tasks."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              to: '/report/new?type=LOST',
              icon: FileText,
              title: 'Report a lost item',
              text: 'Add a photo and details.',
              tone: 'bg-lavender-soft',
            },
            {
              to: '/report/new?type=FOUND',
              icon: Plus,
              title: 'Report a found item',
              text: 'Help someone get it back.',
              tone: 'bg-lime',
            },
            {
              to: '/matches',
              icon: Search,
              title: 'Review matches',
              text: 'Compare images and scores.',
              tone: 'bg-white',
            },
            {
              to: '/claims',
              icon: CheckCircle2,
              title: 'Manage claims',
              text: 'Accept, reject, or follow up.',
              tone: 'bg-bubble',
            },
          ].map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.to}
                to={action.to}
                className={`group flex items-start gap-3 rounded-lg border-[3px] border-ink ${action.tone} p-4 shadow-neo-sm transition-transform hover:-translate-y-0.5`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-ink bg-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-sm font-extrabold text-ink">
                    {action.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink/65">{action.text}</span>
                </span>
                <ArrowRight
                  className="ml-auto mt-2 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle
          title="Recent reports"
          description="Your newest lost and found reports."
          action={
            <NeoLink to="/report/new" variant="white" size="sm">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New report
            </NeoLink>
          }
        />
        {recentReports.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" aria-hidden="true" />}
            title="No reports yet"
            description="Create your first report so fAInd It can start looking for matches."
            action={
              <NeoLink to="/report/new" variant="lime">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create report
              </NeoLink>
            }
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {recentReports.map((report) => (
              <ReportCard key={report.id} report={report} onDelete={deleteReport} />
            ))}
          </div>
        )}
      </section>

      {featuredGroup?.source_report && featuredMatch && (
        <section className="mt-10">
          <SectionTitle
            title="Top match right now"
            description="A quick look at the strongest current candidate."
            action={
              <NeoLink to="/matches" variant="lavender" size="sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                See all matches
              </NeoLink>
            }
          />
          <MatchCard source={featuredGroup.source_report} match={featuredMatch} />
        </section>
      )}
    </PageContainer>
  )
}
