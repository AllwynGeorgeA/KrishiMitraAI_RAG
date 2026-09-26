import { useState } from 'react'
import { AlertTriangle, BarChart3, Check, ShieldCheck, X } from 'lucide-react'
import { EmptyState, ErrorNote, Page, PageHeader, Panel, Rise, Spinner, TiltCard, cx } from '../components/ui'
import { api, type Insights } from '../lib/api'
import { useApi } from '../lib/useApi'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
]

const GUARDRAIL_LABELS: Record<string, string> = {
  relevance: 'Off-topic questions declined',
  prompt_injection: 'Manipulation attempts blocked',
  nemo_guardrails: 'Blocked by extra safety layer',
  empty_input: 'Empty messages',
  retrieval_evidence_threshold: 'Not enough evidence to answer',
  hallucination_guard: 'Answers withheld (unsupported)',
  hallucination_claims_removed: 'Unsupported claims removed',
  other: 'Other refusals',
}

const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function DailyChart({ series }: { series: Insights['questions_per_day'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...series.map((d) => d.questions))
  const tickIdx = series.length <= 7 ? series.map((_, i) => i) : [0, Math.floor((series.length - 1) / 2), series.length - 1]

  return (
    <div>
      <div className="relative h-48">
        {/* recessive gridlines at max and half */}
        {[1, 0.5].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-[var(--line)]" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-transparent text-[10.5px] tabular-nums text-leaf-200/45">{Math.round(max * f)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pr-7" onPointerLeave={() => setHover(null)}>
          {series.map((d, i) => (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 items-end"
              onPointerEnter={() => setHover(i)}
              aria-label={`${fmtDay(d.date)}: ${d.questions} question${d.questions === 1 ? '' : 's'}`}
            >
              <div
                className={cx('w-full rounded-t-[4px] transition-[height,background] duration-500', hover === i ? 'bg-leaf-300' : 'bg-leaf-500')}
                style={{ height: d.questions ? `${(d.questions / max) * 100}%` : '2px', opacity: d.questions ? 1 : 0.25 }}
              />
              {hover === i && (
                <div className="glass-strong pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px]">
                  <div className="text-leaf-200/60">{fmtDay(d.date)}</div>
                  <div className="font-semibold tabular-nums text-leaf-50">{d.questions} question{d.questions === 1 ? '' : 's'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="relative mt-2 h-4 pr-7 text-[11px] text-leaf-200/50">
        {tickIdx.map((i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2"
            style={{ left: `calc(${((i + 0.5) / series.length) * 100}% - ${((i + 0.5) / series.length) * 28}px)` }}
          >
            {fmtDay(series[i].date)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Questions per day</caption>
        <tbody>
          {series.map((d) => <tr key={d.date}><th>{d.date}</th><td>{d.questions}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

const CONF = [
  { key: 'high', label: 'High', cls: 'bg-leaf-500', text: 'text-leaf-300', Icon: Check },
  { key: 'medium', label: 'Medium', cls: 'bg-wheat', text: 'text-wheat', Icon: AlertTriangle },
  { key: 'low', label: 'Low', cls: 'bg-soil', text: 'text-soil', Icon: X },
] as const

function ConfidenceMix({ confidence }: { confidence: Insights['confidence'] }) {
  const total = confidence.high + confidence.medium + confidence.low
  if (!total) return <p className="text-sm text-leaf-200/60">No answers in this period yet.</p>
  const pct = (n: number) => Math.round((n / total) * 100)
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]">
        {CONF.map(({ key, cls, label }) =>
          confidence[key] ? (
            <div key={key} className={cx(cls, 'h-full')} style={{ width: `${pct(confidence[key])}%` }} title={`${label}: ${confidence[key]} (${pct(confidence[key])}%)`} />
          ) : null,
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {CONF.map(({ key, label, cls, text, Icon }) => (
          <li key={key} className="flex items-center gap-2 text-[13px]">
            <span className={cx('size-2.5 rounded-[3px]', cls)} />
            <Icon className={cx('size-3.5', text)} strokeWidth={3} />
            <span className="text-leaf-100/85">{label} confidence</span>
            <span className="ml-auto tabular-nums text-leaf-50">{confidence[key]}</span>
            <span className="w-10 text-right tabular-nums text-leaf-200/55">{pct(confidence[key])}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function InsightsPage() {
  const [days, setDays] = useState(30)
  const { data, error, loading } = useApi(() => api.insights(days), [days])

  const guardrailTotal = data ? Object.entries(data.guardrails).filter(([k]) => k !== 'hallucination_claims_removed').reduce((a, [, v]) => a + v, 0) : 0
  const topMax = Math.max(1, ...(data?.top_schemes ?? []).map((s) => s.count))

  return (
    <Page>
      <PageHeader title="Insights" subtitle="Real usage from every conversation on this server" />

      <div className="mb-5 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            aria-pressed={days === r.days}
            className={cx('chip cursor-pointer px-3 py-1.5 text-[12.5px]', days === r.days && 'border-leaf-500/60 bg-leaf-500/20 text-leaf-200')}
          >
            {r.label}
          </button>
        ))}
        {loading && <Spinner className="ml-1 self-center text-leaf-400" />}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {data && data.questions === 0 && (
        <Panel><EmptyState icon={<BarChart3 className="size-5" />} title="No questions in this period">Insights fill in as people use the chat.</EmptyState></Panel>
      )}

      {data && data.questions > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Questions asked', value: data.questions },
              { label: 'Answered from sources', value: data.answered },
              { label: 'Conversations', value: data.conversations },
              { label: 'Unsupported claims removed', value: data.claims_removed },
            ].map((t, i) => (
              <Rise key={t.label} i={i}>
                <TiltCard className="h-full p-4">
                  <div className="font-display text-3xl font-extrabold tabular-nums">{t.value}</div>
                  <div className="mt-1 text-[13px] text-leaf-200/70">{t.label}</div>
                </TiltCard>
              </Rise>
            ))}
          </div>

          <Rise i={4} className="mt-4">
            <Panel title="Questions per day">
              <DailyChart series={data.questions_per_day} />
            </Panel>
          </Rise>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Rise i={5}>
              <Panel title="Answer confidence" className="h-full">
                <ConfidenceMix confidence={data.confidence} />
              </Panel>
            </Rise>
            <Rise i={6}>
              <Panel title="Safety checks" action={<span className="text-[12px] text-leaf-200/55">{guardrailTotal} refusal{guardrailTotal === 1 ? '' : 's'}</span>} className="h-full">
                {Object.keys(data.guardrails).length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-leaf-200/65"><ShieldCheck className="size-4 text-leaf-400" /> No safety checks triggered in this period.</p>
                ) : (
                  <ul className="divide-y divide-[var(--line)]">
                    {Object.entries(data.guardrails).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between py-2 text-[13px]">
                        <span className="text-leaf-100/85">{GUARDRAIL_LABELS[k] ?? k.replace(/_/g, ' ')}</span>
                        <span className="font-semibold tabular-nums">{v}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </Rise>
          </div>

          {data.top_schemes.length > 0 && (
            <Rise i={7} className="mt-4">
              <Panel title="Most discussed schemes">
                <ul className="space-y-2.5">
                  {data.top_schemes.map((s) => (
                    <li key={s.name} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3 text-[13px] sm:grid-cols-[minmax(0,16rem)_1fr_2.5rem]">
                      <span className="truncate text-leaf-100/85" title={s.name}>{s.name}</span>
                      <div className="h-2.5 rounded-r-[4px] bg-black/25">
                        <div className="h-full rounded-r-[4px] bg-leaf-500 transition-[width] duration-700" style={{ width: `${(s.count / topMax) * 100}%` }} />
                      </div>
                      <span className="text-right tabular-nums text-leaf-50">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Rise>
          )}
        </>
      )}
    </Page>
  )
}
