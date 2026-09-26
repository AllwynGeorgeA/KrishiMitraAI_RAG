import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Check, GitCompare, MessageSquare, Search, X } from 'lucide-react'
import { EmptyState, ErrorNote, Page, PageHeader, Panel, Rise, Spinner, TiltCard, VerdictBadge, cx } from '../components/ui'
import { api, type ChatResponse } from '../lib/api'
import { toApiProfile, useProfile } from '../lib/profile'
import { useApi } from '../lib/useApi'

// Category is derived from the scheme's name only, just to help browsing.
const CATEGORIES: { key: string; label: string; match: RegExp }[] = [
  { key: 'insurance', label: 'Insurance', match: /bima|insurance|pmfby|suraksha|jeevan/i },
  { key: 'credit', label: 'Credit & loans', match: /credit|kcc|loan/i },
  { key: 'income', label: 'Income & pension', match: /samman|kisan$|pm-kisan|maandhan|pension/i },
  { key: 'water', label: 'Irrigation & energy', match: /irrigation|sinchai|pmksy|kusum|water/i },
  { key: 'soil', label: 'Soil health', match: /soil|shc/i },
  { key: 'market', label: 'Markets & processing', match: /enam|sampada|market/i },
]
const categoryOf = (name: string) => CATEGORIES.find((c) => c.match.test(name))

export default function LibraryPage() {
  const navigate = useNavigate()
  const profile = useProfile()
  const { data, error, loading } = useApi(api.schemes)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [comparison, setComparison] = useState<{ scheme_name: string; response: ChatResponse }[] | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  const schemes = useMemo(() => {
    const names = [...new Set((data?.schemes ?? []).map((s) => s.name))].sort((a, b) => a.localeCompare(b))
    return names.filter((n) => (!q || n.toLowerCase().includes(q.toLowerCase())) && (!cat || categoryOf(n)?.key === cat))
  }, [data, q, cat])

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : s.length >= 4 ? s : [...s, name]))

  const compare = async () => {
    setComparing(true)
    setCompareError(null)
    try {
      const r = await api.compare(selected, toApiProfile(profile))
      setComparison(r.comparison)
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setComparing(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Schemes Library"
        subtitle={data ? `${data.count} schemes found in the indexed Vikaspedia sources` : 'Government schemes in the knowledge base'}
      />

      <div className="glass mb-4 flex items-center gap-2 rounded-2xl px-4">
        <Search className="size-4 text-leaf-200/50" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search schemes by name"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-leaf-200/40"
        />
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {[{ key: null, label: 'All' }, ...CATEGORIES].map((c) => (
          <button
            key={c.label}
            onClick={() => setCat(c.key)}
            className={cx('chip cursor-pointer px-3 py-1.5 text-[12.5px]', cat === c.key && 'border-leaf-500/60 bg-leaf-500/20 text-leaf-200')}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && <div className="flex justify-center py-16"><Spinner className="size-6 text-leaf-400" /></div>}
      {!loading && !error && schemes.length === 0 && (
        <Panel><EmptyState icon={<BookOpen className="size-5" />} title="No schemes match">Try a different search or category.</EmptyState></Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {schemes.map((name, i) => {
          const c = categoryOf(name)
          const isSel = selected.includes(name)
          return (
            <Rise key={name} i={i}>
              <TiltCard className={cx('flex h-full flex-col p-4', isSel && 'border-leaf-500/60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-display text-[15px] font-bold leading-snug">{name}</div>
                  <button
                    onClick={() => toggle(name)}
                    aria-pressed={isSel}
                    title={isSel ? 'Remove from comparison' : selected.length >= 4 ? 'You can compare up to 4' : 'Add to comparison'}
                    className={cx(
                      'grid size-7 shrink-0 place-items-center rounded-lg border transition-colors',
                      isSel ? 'border-leaf-500 bg-leaf-500 text-ink' : 'border-[var(--line)] text-leaf-200/60 hover:border-[var(--line-strong)]',
                    )}
                  >
                    {isSel ? <Check className="size-4" strokeWidth={3} /> : <GitCompare className="size-3.5" />}
                  </button>
                </div>
                {c && <span className="chip mt-2 self-start">{c.label}</span>}
                <div className="mt-auto pt-4">
                  <button
                    onClick={() => navigate('/', { state: { ask: `Tell me about ${name}: benefits, who is eligible and how to apply.` } })}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-leaf-400 hover:text-leaf-300"
                  >
                    <MessageSquare className="size-3.5" /> Ask about this scheme
                  </button>
                </div>
              </TiltCard>
            </Rise>
          )
        })}
      </div>

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="glass-strong fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl p-3 shadow-2xl md:left-[292px]"
          >
            <span className="text-[13px] text-leaf-200/80">{selected.length} selected{selected.length < 2 && ' · pick at least 2'}</span>
            <div className="flex flex-1 flex-wrap gap-1">
              {selected.map((n) => (
                <button key={n} onClick={() => toggle(n)} className="chip cursor-pointer">{n} <X className="size-3" /></button>
              ))}
            </div>
            <button onClick={compare} disabled={selected.length < 2 || comparing} className="btn btn-primary">
              {comparing ? <Spinner /> : <GitCompare className="size-4" />} {comparing ? 'Comparing…' : 'Compare'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {compareError && <div className="mt-4"><ErrorNote>{compareError}</ErrorNote></div>}

      {comparison && (
        <div className="mt-8 pb-20">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Side-by-side</h2>
            <button onClick={() => setComparison(null)} className="btn btn-ghost h-8 text-[12.5px]"><X className="size-3.5" /> Close</button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))` }}>
            {comparison.map(({ scheme_name, response }, i) => {
              const s = response.schemes[0]
              return (
                <Rise key={scheme_name} i={i}>
                  <Panel title={scheme_name} className="h-full">
                    {s && <VerdictBadge status={s.eligibility_status} />}
                    {s?.benefits.length ? (
                      <ul className="mt-3 space-y-1.5 text-[13px] text-leaf-100/85">
                        {s.benefits.slice(0, 4).map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf-400" /> {b}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-3 line-clamp-[10] text-[13px] text-leaf-100/75">{response.answer}</p>
                    )}
                    {s?.eligibility_points.length ? (
                      <>
                        <div className="mt-4 text-[11px] font-bold uppercase tracking-wide text-leaf-200/50">Who is eligible</div>
                        <ul className="mt-1.5 space-y-1 text-[13px] text-leaf-100/75">
                          {s.eligibility_points.slice(0, 3).map((e) => <li key={e}>• {e}</li>)}
                        </ul>
                      </>
                    ) : null}
                  </Panel>
                </Rise>
              )
            })}
          </div>
        </div>
      )}
    </Page>
  )
}
