import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Database,
  FlaskConical,
  Play,
  Sparkles,
  Trophy,
} from 'lucide-react'
import {
  EmptyState,
  LoadingState,
  NeoAlert,
  NeoBadge,
  NeoButton,
  NeoCard,
  PageContainer,
  PageHeader,
  SectionTitle,
  StatCard,
} from '../components/neo'
import { API_BASE, authHeaders } from '../lib/api'

function formatMetric(value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

function formatMrr(value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A'
  return value.toFixed(3)
}

function formatLatency(value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A'
  return `${value.toFixed(0)} ms`
}

export default function Evaluation() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [runMessage, setRunMessage] = useState('')
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadSummary()
  }, [token, navigate])

  const loadSummary = async () => {
    setError('')
    try {
      const response = await fetch(`${API_BASE}/evaluation/summary`, {
        headers: authHeaders(token),
      })
      if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to load evaluation summary')
      }
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluation summary')
    } finally {
      setLoading(false)
    }
  }

  const runEvaluation = async () => {
    setRunning(true)
    setError('')
    setRunMessage(
      'Loading pretrained models and generating embeddings. This can take a few minutes on CPU.',
    )
    try {
      const response = await fetch(`${API_BASE}/evaluation/run`, {
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
        throw new Error(data.detail || 'Failed to run evaluation')
      }
      setSummary(data)
      setRunMessage('Evaluation complete. Results were saved by the backend.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run evaluation')
      setRunMessage('')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState label="Loading evaluation results..." />
      </PageContainer>
    )
  }

  const experiments: any[] = summary?.experiments || []
  const bestExperiment = experiments.reduce(
    (best, experiment) =>
      experiment.mrr !== null &&
      experiment.mrr !== undefined &&
      (best === null || experiment.mrr > best.mrr)
        ? experiment
        : best,
    null as any,
  )

  return (
    <PageContainer className="py-10 sm:py-12">
      <PageHeader
        icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
        eyebrow="Real computed results"
        title="Evaluation"
        subtitle="A transparent view of the local smoke evaluation. No metrics are fabricated and no model training is performed."
        actions={
          summary?.can_run ? (
            <NeoButton type="button" variant="lime" loading={running} onClick={runEvaluation}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {running ? 'Running...' : 'Run evaluation'}
            </NeoButton>
          ) : undefined
        }
      />

      {error && (
        <NeoAlert tone="error" className="mb-6">
          {error}
        </NeoAlert>
      )}

      {runMessage && (
        <NeoAlert tone={running ? 'info' : 'success'} className="mb-6">
          {runMessage}
        </NeoAlert>
      )}

      <NeoAlert tone="warning" className="mb-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            The smoke set is intentionally small and is not a representative campus benchmark.
            Similarity scores are ranking signals, not calibrated match probabilities.
          </p>
        </div>
      </NeoAlert>

      {!summary?.available ? (
        <EmptyState
          icon={<FlaskConical className="h-7 w-7" aria-hidden="true" />}
          title="No evaluation results yet"
          description="Run the reproducible evaluation script to generate saved JSON and CSV results. An admin can also use the Run evaluation button."
          action={
            <NeoCard className="w-full max-w-xl p-4 text-left">
              <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">
                Terminal
              </p>
              <pre className="mt-2 overflow-x-auto rounded border-2 border-ink bg-ink p-3 text-xs text-lime">
                cd backend{'\n'}venv/bin/python -m app.services.evaluation_service
              </pre>
            </NeoCard>
          }
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Dataset"
              value={summary.dataset?.name || 'N/A'}
              tone="lavender"
              icon={<Database className="h-5 w-5" aria-hidden="true" />}
              hint={`${summary.dataset?.query_count ?? 'N/A'} queries · ${
                summary.dataset?.candidate_count ?? 'N/A'
              } candidates`}
            />
            <StatCard
              label="Best MRR"
              value={formatMrr(bestExperiment?.mrr)}
              tone="lime"
              icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
              hint={bestExperiment?.name || 'No experiments available'}
            />
            <StatCard
              label="Embedding time"
              value={formatLatency(summary.run?.embedding_latency_ms)}
              tone="white"
              icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
              hint="Model load and embedding generation"
            />
            <StatCard
              label="Run date"
              value={
                summary.run?.run_at
                  ? new Date(summary.run.run_at).toLocaleDateString()
                  : 'N/A'
              }
              tone="pink"
              icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
              hint={summary.run?.scoring_version || 'Scoring version N/A'}
            />
          </section>

          <section className="mt-8">
            <SectionTitle
              title="Experiment comparison"
              description="Retrieval quality and latency for each fusion configuration."
            />
            <NeoCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b-[3px] border-ink bg-lavender-soft">
                      <th className="px-4 py-3 text-left font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink">
                        Experiment
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink">
                        Precision@5
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink">
                        Recall@5
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink">
                        F1
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink">
                        MRR
                      </th>
                      <th className="px-4 py-3 text-right font-display text-xs font-extrabold uppercase tracking-[0.12em] text-ink">
                        Retrieval latency
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {experiments.map((experiment: any) => {
                      const isBest = bestExperiment?.id === experiment.id
                      return (
                        <tr
                          key={experiment.id}
                          className={`border-b-2 border-ink last:border-b-0 ${
                            isBest ? 'bg-lime/35' : 'bg-white'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-sm font-extrabold text-ink">
                                {experiment.name}
                              </span>
                              {isBest && <NeoBadge tone="accepted">Best MRR</NeoBadge>}
                            </div>
                            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
                              {experiment.description}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-ink">
                            {formatMetric(experiment.precision_at_5)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-ink">
                            {formatMetric(experiment.recall_at_5)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-ink">
                            {formatMetric(experiment.f1)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-ink">
                            {formatMrr(experiment.mrr)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-ink">
                            {formatLatency(experiment.average_retrieval_latency_ms)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </NeoCard>
          </section>

          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <NeoCard className="p-5 sm:p-6">
              <h2 className="font-display text-xl font-extrabold text-ink">Run configuration</h2>
              <dl className="mt-4 grid gap-2 text-sm">
                {[
                  ['Image model', summary.run?.models?.image_model || 'N/A'],
                  ['Image dimension', summary.run?.models?.image_dimension || 'N/A'],
                  ['Text model', summary.run?.models?.text_model || 'N/A'],
                  ['Text dimension', summary.run?.models?.text_dimension || 'N/A'],
                  ['Scoring version', summary.run?.scoring_version || 'N/A'],
                  ['Top-k', summary.run?.top_k || 'N/A'],
                  [
                    'Fusion weights',
                    `image ${summary.run?.weights?.image ?? 'N/A'}, text ${
                      summary.run?.weights?.text ?? 'N/A'
                    }, metadata ${summary.run?.weights?.metadata ?? 'N/A'}`,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1 rounded border-2 border-ink bg-cream px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <dt className="font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                      {label}
                    </dt>
                    <dd className="text-sm font-bold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </NeoCard>

            <NeoCard className="p-5 sm:p-6">
              <h2 className="font-display text-xl font-extrabold text-ink">Metric conventions</h2>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
                {[
                  summary.dataset?.metric_conventions?.precision_at_5,
                  summary.dataset?.metric_conventions?.recall_at_5,
                  summary.dataset?.metric_conventions?.f1,
                  summary.dataset?.metric_conventions?.mrr,
                  summary.dataset?.metric_conventions?.latency,
                ]
                  .filter(Boolean)
                  .map((item: string) => (
                    <li key={item} className="rounded border-2 border-ink bg-lavender-soft p-2">
                      {item}
                    </li>
                  ))}
              </ul>
            </NeoCard>
          </section>

          <section className="mt-8">
            <NeoCard className="p-5 sm:p-6">
              <h2 className="font-display text-xl font-extrabold text-ink">
                Dataset and limitations
              </h2>
              <div className="mt-4 grid gap-3 text-sm leading-relaxed text-muted lg:grid-cols-2">
                <p>{summary.dataset?.description}</p>
                <div className="space-y-2">
                  <p>
                    <span className="font-display text-xs font-extrabold uppercase tracking-wide text-ink">
                      Label procedure:{' '}
                    </span>
                    {summary.dataset?.label_procedure}
                  </p>
                  <p>
                    <span className="font-display text-xs font-extrabold uppercase tracking-wide text-ink">
                      Real-derived data:{' '}
                    </span>
                    {summary.dataset?.provenance?.real_derived}
                  </p>
                  <p>
                    <span className="font-display text-xs font-extrabold uppercase tracking-wide text-ink">
                      Synthetic data:{' '}
                    </span>
                    {summary.dataset?.provenance?.synthetic}
                  </p>
                </div>
              </div>
              <NeoAlert tone="info" className="mt-4">
                No model training or fine-tuning is performed. Metadata scoring is heuristic.
                Results from this smoke set should not be presented as evidence of general campus
                performance.
              </NeoAlert>
            </NeoCard>
          </section>
        </>
      )}
    </PageContainer>
  )
}
