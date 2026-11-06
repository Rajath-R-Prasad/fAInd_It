import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { NeoCard, NeoLink, PageContainer } from '../components/neo'

const steps = [
  {
    icon: FileText,
    title: 'Report',
    text: 'Post a lost or found item with a photo and the details that make it identifiable.',
    tone: 'lavender' as const,
  },
  {
    icon: Search,
    title: 'Match',
    text: 'CLIP and MiniLM compare images, text, and metadata to surface the strongest candidates.',
    tone: 'lime' as const,
  },
  {
    icon: CheckCircle2,
    title: 'Reunite',
    text: 'Use the claims workflow to verify ownership. Contact details unlock only after acceptance.',
    tone: 'white' as const,
  },
]

export default function Home() {
  const token = localStorage.getItem('token')

  return (
    <PageContainer className="py-10 sm:py-14">
      <section className="relative overflow-hidden rounded-xl border-[3px] border-ink bg-white p-6 shadow-neo-lime sm:p-10 lg:p-12">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border-[3px] border-ink bg-lavender opacity-70" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-24 w-24 rotate-12 border-[3px] border-ink bg-bubble opacity-70" />
        <div className="pointer-events-none absolute right-10 top-24 hidden h-16 w-16 -rotate-12 items-center justify-center border-[3px] border-ink bg-lime shadow-[4px_4px_0_#111111] sm:flex">
          <Zap className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
        </div>

        <div className="relative max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded border-2 border-ink bg-lime px-3 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.2em] shadow-[2px_2px_0_#111111]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            AI-powered lost and found
          </p>
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Lose something?
            <span className="mt-2 block w-fit -rotate-1 border-[3px] border-ink bg-lime px-2 py-1 shadow-[5px_5px_0_#111111]">
              fAInd it.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Report lost or found items, let pretrained vision and language models rank
            potential matches, and reconnect with the owner through a verified claims
            workflow.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <NeoLink to={token ? '/dashboard' : '/register'} size="lg" variant="lime">
              {token ? 'Open dashboard' : 'Get started'}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </NeoLink>
            <NeoLink to={token ? '/report/new' : '/login'} size="lg" variant="white">
              {token ? 'Report an item' : 'Login'}
            </NeoLink>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-muted">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Similarity scores are ranking signals, not proof of ownership.
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <NeoCard
              key={step.title}
              tone={step.tone}
              className="relative overflow-hidden p-5 sm:p-6"
            >
              <span className="absolute right-4 top-4 font-display text-5xl font-extrabold text-ink/10">
                0{index + 1}
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-md border-[3px] border-ink bg-white shadow-[3px_3px_0_#111111]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-extrabold text-ink">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
            </NeoCard>
          )
        })}
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <NeoCard className="p-6 sm:p-8">
          <h2 className="font-display text-2xl font-extrabold text-ink">
            Built for a real campus workflow
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              'Image, text, and metadata matching',
              'Top-five candidate ranking',
              'Claims with owner approval',
              'Contact details unlocked only after acceptance',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-md border-2 border-ink bg-cream p-3 text-sm font-semibold text-ink"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </NeoCard>

        <NeoCard tone="lavender" className="flex flex-col justify-between p-6 sm:p-8">
          <div>
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-ink/70">
              Ready to try it?
            </p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-ink">
              Report it. Match it. Get it back.
            </h2>
          </div>
          <Link
            to={token ? '/report/new' : '/register'}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-md border-[3px] border-ink bg-white px-4 py-3 font-display text-sm font-extrabold uppercase tracking-wide shadow-neo-btn transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#111111]"
          >
            {token ? 'Create a report' : 'Create an account'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </NeoCard>
      </section>
    </PageContainer>
  )
}
