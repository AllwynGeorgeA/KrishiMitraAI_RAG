import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, Globe, ShieldCheck, ShieldAlert } from 'lucide-react'
import type { ChatResponse } from '../lib/api'
import { ConfidenceBadge, VerdictBadge, cx } from './ui'

const SOURCE_LABEL = { vikaspedia: 'Vikaspedia', trusted_document: 'Trusted document', user_upload: 'Your upload' } as const

export default function AnswerCard({ data, onFollowUp }: { data: ChatResponse; onFollowUp: (q: string) => void }) {
  const [showSources, setShowSources] = useState(false)
  const [copied, setCopied] = useState(false)
  const trust = data.trust_check

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className={cx('glass relative w-full rounded-2xl rounded-tl-md p-4 sm:p-5', data.refused && 'border-wheat/25')}>
      <div className="mb-3 flex flex-wrap items-center gap-2 pr-9">
        {data.refused ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-wheat/30 bg-wheat/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-wheat">
            <ShieldAlert className="size-3" /> Can't answer from verified sources
          </span>
        ) : (
          <ConfidenceBadge level={data.confidence} />
        )}
      </div>
      <button
        onClick={copy}
        title="Copy answer"
        aria-label="Copy answer"
        className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-leaf-200/60 transition-colors hover:bg-leaf-500/12 hover:text-leaf-300"
      >
        {copied ? <Check className="size-4 text-leaf-400" /> : <Copy className="size-4" />}
      </button>

      <div className="prose-answer">{data.answer}</div>

      {data.schemes.length > 0 && (
        <div className="mt-4 grid gap-3">
          {data.schemes.map((s, i) => (
            <motion.div
              key={s.scheme_name + i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
              className="rounded-xl border border-[var(--line)] bg-black/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-display text-[15px] font-bold text-leaf-50">{s.scheme_name}</div>
                <VerdictBadge status={s.eligibility_status} />
              </div>
              {s.why_it_matches && <p className="mt-1.5 text-sm text-leaf-100/75">{s.why_it_matches}</p>}
              {s.benefits.length > 0 && (
                <ul className="mt-2.5 space-y-1 text-sm text-leaf-100/85">
                  {s.benefits.slice(0, 4).map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-400" /> <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.eligibility_explanation && (
                <p className="mt-2.5 rounded-lg bg-leaf-500/6 px-3 py-2 text-[13px] text-leaf-200/80">{s.eligibility_explanation}</p>
              )}
              {s.next_step && (
                <p className="mt-2.5 flex gap-1.5 text-[13px] font-semibold text-leaf-300">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0" /> {s.next_step}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {data.missing_information.length > 0 && (
        <p className="mt-4 text-[13px] text-wheat/90">
          <span className="font-semibold">To check eligibility, I still need:</span> {data.missing_information.join(', ')}
        </p>
      )}

      {trust && !data.refused && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-leaf-200/70">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5 text-leaf-400" /> Grounded in {data.evidence.length} source passage{data.evidence.length === 1 ? '' : 's'}</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5 text-leaf-400" /> Fact-checked{trust.claims_removed ? ` · ${trust.claims_removed} unsupported claim${trust.claims_removed === 1 ? '' : 's'} removed` : ''}</span>
        </div>
      )}

      {data.evidence.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowSources((v) => !v)}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-leaf-400 hover:text-leaf-300"
          >
            {showSources ? 'Hide sources' : `View ${data.evidence.length} source${data.evidence.length === 1 ? '' : 's'}`}
            <ChevronDown className={cx('size-3.5 transition-transform', showSources && 'rotate-180')} />
          </button>
          {showSources && (
            <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 space-y-2 overflow-hidden">
              {data.evidence.map((e) => (
                <li key={e.chunk_id} className="rounded-lg border border-[var(--line)] bg-black/20 p-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-leaf-100">{e.title}</span>
                    {e.section && <span className="text-leaf-200/60">· {e.section}</span>}
                    <span className="chip ml-auto">{SOURCE_LABEL[e.source_type] ?? e.source_type}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-leaf-100/65">{e.text}</p>
                  {e.source_url && (
                    <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-leaf-400 hover:underline">
                      Open source <ExternalLink className="size-3" />
                    </a>
                  )}
                </li>
              ))}
            </motion.ul>
          )}
        </div>
      )}

      {data.follow_up_questions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.follow_up_questions.map((q) => (
            <button key={q} onClick={() => onFollowUp(q)} className="chip cursor-pointer py-1 hover:border-[var(--line-strong)] hover:text-leaf-200">
              {q}
            </button>
          ))}
        </div>
      )}

      {data.web_results && data.web_results.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-wheat/30 bg-wheat/5 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-wheat/90">
            <Globe className="size-3.5" /> Live web results · unverified, not from the vetted knowledge base
          </div>
          <ul className="space-y-2">
            {data.web_results.map((r) => (
              <li key={r.url} className="text-[13px]">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-leaf-300 hover:underline">{r.title}</a>
                {r.snippet && <p className="text-leaf-100/60">{r.snippet}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
