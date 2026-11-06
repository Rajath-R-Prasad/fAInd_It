import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  FileText,
  Flag,
  Inbox,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react'
import {
  LoadingState,
  NeoAlert,
  NeoBadge,
  NeoButton,
  NeoCard,
  NeoInput,
  NeoLink,
  NeoSelect,
  PageContainer,
  PageHeader,
  SectionTitle,
  StatCard,
} from '../components/neo'
import { API_BASE, authHeaders } from '../lib/api'
import { badgeToneForStatus } from '../lib/badges'
import type { Claim, Report } from '../lib/types'

export default function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    moderation_status: '',
    search: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [moderatingId, setModeratingId] = useState<string | null>(null)
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadAll()
  }, [token, navigate])

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError('')
    try {
      const headers = authHeaders(token)
      const params = new URLSearchParams()
      if (filters.type) params.set('report_type', filters.type)
      if (filters.status) params.set('status', filters.status)
      if (filters.moderation_status) params.set('moderation_status', filters.moderation_status)
      if (filters.search) params.set('search', filters.search)

      const [reportsResponse, claimsResponse] = await Promise.all([
        fetch(`${API_BASE}/admin/reports?${params.toString()}`, { headers }),
        fetch(`${API_BASE}/admin/claims`, { headers }),
      ])

      if (reportsResponse.status === 401 || claimsResponse.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      if (reportsResponse.status === 403 || claimsResponse.status === 403) {
        throw new Error('Admin access required')
      }
      if (!reportsResponse.ok || !claimsResponse.ok) {
        throw new Error('Failed to load admin data')
      }

      setReports(await reportsResponse.json())
      setClaims(await claimsResponse.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const moderate = async (reportId: string, action: 'flag' | 'remove') => {
    setError('')
    setModeratingId(reportId)
    try {
      const response = await fetch(`${API_BASE}/admin/reports/${reportId}/${action}`, {
        method: 'POST',
        headers: authHeaders(token),
      })
      if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Failed to ${action} report`)
      }
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} report`)
    } finally {
      setModeratingId(null)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState label="Loading admin data..." />
      </PageContainer>
    )
  }

  const flagged = reports.filter((report) => report.moderation_status === 'FLAGGED').length
  const removed = reports.filter((report) => report.moderation_status === 'REMOVED').length
  const pendingClaims = claims.filter((claim) => claim.status === 'PENDING').length

  return (
    <PageContainer className="py-10 sm:py-12">
      <PageHeader
        icon={<Shield className="h-6 w-6" aria-hidden="true" />}
        eyebrow="Moderation"
        title="Admin Dashboard"
        subtitle="Review reports, apply moderation actions, and monitor the claims queue."
        actions={
          <>
            <NeoLink to="/dashboard" variant="white">
              Dashboard
            </NeoLink>
            <NeoButton
              type="button"
              variant="lavender"
              loading={refreshing}
              onClick={() => loadAll(true)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </NeoButton>
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
          label="Reports shown"
          value={reports.length}
          tone="lavender"
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          hint="Respecting current filters"
        />
        <StatCard
          label="Flagged"
          value={flagged}
          tone="lime"
          icon={<Flag className="h-5 w-5" aria-hidden="true" />}
          hint={`${removed} removed`}
        />
        <StatCard
          label="Claims"
          value={claims.length}
          tone="white"
          icon={<Inbox className="h-5 w-5" aria-hidden="true" />}
          hint="All claims in the system"
        />
        <StatCard
          label="Pending claims"
          value={pendingClaims}
          tone="pink"
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          hint="Awaiting owner review"
        />
      </section>

      <section className="mt-8">
        <SectionTitle
          title="Filter reports"
          description="Narrow the report table by type, status, moderation state, or title."
        />
        <NeoCard className="p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr_auto] xl:items-end">
            <NeoSelect
              label="Type"
              value={filters.type}
              onChange={(event) => setFilters({ ...filters, type: event.target.value })}
            >
              <option value="">All types</option>
              <option value="LOST">LOST</option>
              <option value="FOUND">FOUND</option>
            </NeoSelect>
            <NeoSelect
              label="Status"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">All statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="MATCHED">MATCHED</option>
              <option value="CLOSED">CLOSED</option>
            </NeoSelect>
            <NeoSelect
              label="Moderation"
              value={filters.moderation_status}
              onChange={(event) =>
                setFilters({ ...filters, moderation_status: event.target.value })
              }
            >
              <option value="">All moderation</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="FLAGGED">FLAGGED</option>
              <option value="REMOVED">REMOVED</option>
            </NeoSelect>
            <NeoInput
              label="Search title"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Search by report title"
            />
            <NeoButton type="button" variant="lime" onClick={() => loadAll()}>
              Apply filters
            </NeoButton>
          </div>
        </NeoCard>
      </section>

      <section className="mt-8">
        <SectionTitle
          title={`Reports (${reports.length})`}
          description="Moderate individual reports without leaving this table."
        />
        <NeoCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b-[3px] border-ink bg-lavender-soft">
                  {['Type', 'Title', 'Status', 'Moderation', 'Location', 'Actions'].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-muted">
                      No reports match the current filters.
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="border-b-2 border-ink bg-white last:border-b-0">
                      <td className="px-4 py-3">
                        <NeoBadge tone={badgeToneForStatus(report.type)}>{report.type}</NeoBadge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-display text-sm font-extrabold text-ink">
                          {report.title}
                        </p>
                        <p className="text-xs text-muted">{report.category || 'Uncategorised'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <NeoBadge tone={badgeToneForStatus(report.status)}>
                          {report.status || 'OPEN'}
                        </NeoBadge>
                      </td>
                      <td className="px-4 py-3">
                        <NeoBadge tone={badgeToneForStatus(report.moderation_status)}>
                          {report.moderation_status || 'ACTIVE'}
                        </NeoBadge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-muted">
                        {report.location || 'Not set'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <NeoButton
                            type="button"
                            variant="lavender"
                            size="sm"
                            disabled={moderatingId === report.id}
                            onClick={() => moderate(report.id, 'flag')}
                          >
                            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                            Flag
                          </NeoButton>
                          <NeoButton
                            type="button"
                            variant="pink"
                            size="sm"
                            disabled={moderatingId === report.id}
                            onClick={() => moderate(report.id, 'remove')}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Remove
                          </NeoButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </NeoCard>
      </section>

      <section className="mt-8">
        <SectionTitle
          title={`Claims (${claims.length})`}
          description="A read-only view of the claims queue."
        />
        <NeoCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b-[3px] border-ink bg-lavender-soft">
                  {['Report', 'Message', 'Status', 'Created'].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-muted">
                      No claims yet.
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => (
                    <tr key={claim.id} className="border-b-2 border-ink bg-white last:border-b-0">
                      <td className="px-4 py-3 font-display text-sm font-extrabold text-ink">
                        {claim.report?.title || claim.report_id}
                      </td>
                      <td className="max-w-md px-4 py-3 text-sm leading-relaxed text-muted">
                        {claim.message || 'No message'}
                      </td>
                      <td className="px-4 py-3">
                        <NeoBadge tone={badgeToneForStatus(claim.status)}>
                          {claim.status}
                        </NeoBadge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-muted">
                        {claim.created_at
                          ? new Date(claim.created_at).toLocaleString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </NeoCard>
      </section>
    </PageContainer>
  )
}
