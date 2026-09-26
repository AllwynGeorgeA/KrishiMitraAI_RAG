import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Globe, Lock, Save, Trash2 } from 'lucide-react'
import { Page, PageHeader, Panel, Rise, cx } from '../components/ui'
import { Field } from './EligibilityPage'
import {
  CATEGORIES, CROPS, EMPTY_PROFILE, FARMER_TYPES, INDIAN_STATES, clearProfile, profileCompleteness, saveProfile, useProfile, type StoredProfile,
} from '../lib/profile'

export default function ProfilePage() {
  const saved = useProfile()
  const [form, setForm] = useState<StoredProfile>(saved)
  const [toast, setToast] = useState<string | null>(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const set = (k: keyof StoredProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })
  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <Page className="max-w-3xl">
      <PageHeader title="Farmer profile" subtitle="Used to personalise answers and check scheme eligibility" />

      <Rise>
        <Panel title="About your farm" action={<span className="text-[12px] text-leaf-200/55">{profileCompleteness(form)}% complete</span>}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveProfile(form)
              flash('Profile saved')
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name (optional)">
                <input className="field" value={form.name} onChange={set('name')} placeholder="e.g. Murugan" />
              </Field>
              <Field label="State">
                <select className="field" value={form.state} onChange={set('state')}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="District (optional)">
                <input className="field" value={form.district} onChange={set('district')} placeholder="e.g. Thanjavur" />
              </Field>
              <Field label="Main crop">
                <select className="field" value={form.crop} onChange={set('crop')}>
                  <option value="">Select crop</option>
                  {CROPS.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Land you farm (acres)">
                <input className="field" type="number" min="0" step="0.1" inputMode="decimal" value={form.landAcres} onChange={set('landAcres')} placeholder="e.g. 2.5" />
              </Field>
              <Field label="Farmer type">
                <select className="field" value={form.farmerType} onChange={set('farmerType')}>
                  <option value="">Select type</option>
                  {FARMER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Irrigation (optional)">
                <select className="field" value={form.irrigation} onChange={set('irrigation')}>
                  <option value="">Select</option>
                  <option value="rainfed">Rain-fed</option>
                  <option value="irrigated">Irrigated</option>
                </select>
              </Field>
              <Field label="Social category (optional)">
                <select className="field" value={form.category} onChange={set('category')}>
                  <option value="">Prefer not to say</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-4">
              <Globe className="size-5 shrink-0 text-wheat" />
              <div className="flex-1">
                <div className="text-sm font-semibold">Live web results by default</div>
                <div className="text-[12.5px] text-leaf-200/60">Adds unverified web links next to answers. Shown separately, never mixed into cited answers.</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.webSearch}
                onClick={() => setForm({ ...form, webSearch: !form.webSearch })}
                className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', form.webSearch ? 'bg-leaf-500' : 'bg-white/15')}
              >
                <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', form.webSearch ? 'translate-x-5.5' : 'translate-x-0.5')} />
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-[12.5px] text-leaf-200/55">
                <Lock className="size-3.5" /> Stored only on this device. Sent with your questions, never saved on the server as a profile.
              </p>
              <button type="submit" disabled={!dirty} className="btn btn-primary">
                <Save className="size-4" /> Save changes
              </button>
            </div>
          </form>
        </Panel>
      </Rise>

      <Rise i={1} className="mt-4">
        <Panel title="Clear data">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-leaf-200/65">Remove your saved profile from this device.</p>
            <button
              onClick={() => {
                clearProfile()
                setForm({ ...EMPTY_PROFILE })
                flash('Profile cleared')
              }}
              className="btn btn-ghost border-soil/30 text-red-200 hover:bg-soil/10"
            >
              <Trash2 className="size-4" /> Clear profile
            </button>
          </div>
        </Panel>
      </Rise>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-strong fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-leaf-300"
          >
            <Check className="size-4" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}

