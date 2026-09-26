import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Check, ClipboardCheck, Info } from 'lucide-react'
import { ConfidenceBadge, ErrorNote, Page, PageHeader, Panel, Rise, Spinner, TiltCard, VerdictBadge } from '../components/ui'
import { api, type ChatResponse } from '../lib/api'
import { CATEGORIES, CROPS, FARMER_TYPES, INDIAN_STATES, saveProfile, toApiProfile, useProfile, type StoredProfile } from '../lib/profile'

const QUESTION = 'Which government schemes am I eligible for as a farmer, and what benefits do they give?'
const ORDER = { likely_eligible: 0, possibly_eligible: 1, insufficient_information: 2, likely_not_eligible: 3 }

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-leaf-100/80">{label}</span>
      {children}
    </label>
  )
}

export default function EligibilityPage() {
  const saved = useProfile()
  const [form, setForm] = useState<StoredProfile>(saved)
  const [remember, setRemember] = useState(true)
  const [result, setResult] = useState<ChatResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof StoredProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (remember) saveProfile({ ...saved, ...form })
    setLoading(true)
    setError(null)
    try {
      setResult(await api.chat(QUESTION, toApiProfile(form)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setLoading(false)
    }
  }

  const schemes = [...(result?.schemes ?? [])].sort((a, b) => ORDER[a.eligibility_status] - ORDER[b.eligibility_status])

  return (
    <Page>
      <PageHeader title="Eligibility Checker" subtitle="Tell us about your farm and we'll match it against each scheme's documented criteria" />

      <Rise>
        <Panel title="Your farm">
          <form onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="State">
                <select className="field" value={form.state} onChange={set('state')}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Main crop">
                <select className="field capitalize" value={form.crop} onChange={set('crop')}>
                  <option value="">Select crop</option>
                  {CROPS.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Land you farm (acres)">
                <input className="field" type="number" min="0" step="0.1" inputMode="decimal" placeholder="e.g. 2.5" value={form.landAcres} onChange={set('landAcres')} />
              </Field>
              <Field label="Farmer type">
                <select className="field" value={form.farmerType} onChange={set('farmerType')}>
                  <option value="">Select type</option>
                  {FARMER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Social category (optional)">
                <select className="field" value={form.category} onChange={set('category')}>
                  <option value="">Prefer not to say</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="District (optional)">
                <input className="field" placeholder="e.g. Thanjavur" value={form.district} onChange={set('district')} />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-leaf-200/75">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-leaf-500" />
                Save to my profile (stays on this device)
              </label>
              <button type="submit" disabled={loading} className="btn btn-primary h-11 px-6">
                {loading ? <Spinner /> : <ClipboardCheck className="size-4" />} {loading ? 'Checking…' : 'Check eligibility'}
              </button>
            </div>
          </form>
        </Panel>
      </Rise>

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">
              {schemes.length ? `${schemes.length} scheme${schemes.length === 1 ? '' : 's'} checked against your details` : 'Results'}
            </h2>
            {!result.refused && <ConfidenceBadge level={result.confidence} />}
          </div>

          {schemes.length === 0 ? (
            <Panel>
              <p className="prose-answer">{result.answer}</p>
            </Panel>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {schemes.map((s, i) => (
                <Rise key={s.scheme_name} i={i}>
                  <TiltCard max={5} className="h-full p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-display text-base font-bold">{s.scheme_name}</div>
                      <VerdictBadge status={s.eligibility_status} />
                    </div>
                    {s.eligibility_explanation && <p className="mt-2 text-[13px] text-leaf-100/75">{s.eligibility_explanation}</p>}
                    {s.benefits.length > 0 && (
                      <ul className="mt-3 space-y-1 text-[13px] text-leaf-100/85">
                        {s.benefits.slice(0, 3).map((b) => (
                          <li key={b} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf-400" /> {b}</li>
                        ))}
                      </ul>
                    )}
                    {s.missing_information.length > 0 && (
                      <p className="mt-3 flex gap-1.5 text-[12.5px] text-wheat/90"><Info className="mt-0.5 size-3.5 shrink-0" /> Needs: {s.missing_information.join(', ')}</p>
                    )}
                    {s.next_step && <p className="mt-3 flex gap-1.5 text-[13px] font-semibold text-leaf-300"><ArrowRight className="mt-0.5 size-3.5 shrink-0" /> {s.next_step}</p>}
                  </TiltCard>
                </Rise>
              ))}
            </div>
          )}
          <p className="mt-4 text-[12.5px] text-leaf-200/55">
            This is guidance from documented criteria, not an official decision. Confirm with your local agriculture office before applying.{' '}
            <Link to="/" className="text-leaf-400 hover:underline">Ask a follow-up in chat →</Link>
          </p>
        </motion.div>
      )}
    </Page>
  )
}
