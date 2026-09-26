import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlertCircle, CheckCircle2, FileAudio, FileImage, FileSpreadsheet, FileText, MessageSquare, Trash2, UploadCloud } from 'lucide-react'
import { EmptyState, Page, PageHeader, Panel, Rise, Spinner, cx } from '../components/ui'
import { api } from '../lib/api'

interface DocItem {
  id: string
  name: string
  size: number
  at: string
  status: 'processing' | 'indexed' | 'failed'
  chunks?: number
  error?: string
}

// The server has no per-user document list yet, so this list is what was uploaded from this device.
const KEY = 'krishimitra.uploads.v1'
const load = (): DocItem[] => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || '[]') as DocItem[]).filter((d) => d.status !== 'processing')
  } catch {
    return []
  }
}
const persist = (items: DocItem[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)))
  } catch {
    /* storage blocked */
  }
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.wav,.mp3,.m4a'
const MAX_MB = 15

function iconFor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg'].includes(ext)) return FileImage
  if (['xlsx', 'xls', 'csv'].includes(ext)) return FileSpreadsheet
  if (['wav', 'mp3', 'm4a'].includes(ext)) return FileAudio
  return FileText
}
const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`)

export default function DocumentsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<DocItem[]>(load)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const update = (id: string, patch: Partial<DocItem>) =>
    setItems((cur) => {
      const next = cur.map((d) => (d.id === id ? { ...d, ...patch } : d))
      persist(next)
      return next
    })

  const handle = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const id = Math.random().toString(36).slice(2, 10)
      const item: DocItem = { id, name: file.name, size: file.size, at: new Date().toISOString(), status: 'processing' }
      setItems((cur) => [item, ...cur])
      if (file.size > MAX_MB * 1e6) {
        update(id, { status: 'failed', error: `Larger than ${MAX_MB} MB` })
        continue
      }
      try {
        const r = await api.upload(file)
        update(id, { status: 'indexed', chunks: r.chunks_created })
      } catch (e) {
        update(id, { status: 'failed', error: e instanceof Error ? e.message : 'Upload failed' })
      }
    }
  }

  const remove = (id: string) =>
    setItems((cur) => {
      const next = cur.filter((d) => d.id !== id)
      persist(next)
      return next
    })

  return (
    <Page>
      <PageHeader title="Documents" subtitle="Add your own papers (land records, scheme circulars, soil reports) so you can ask questions about them" />

      <Rise>
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files) }}
          onClick={() => input.current?.click()}
          animate={{ scale: drag ? 1.015 : 1, rotateX: drag ? 4 : 0 }}
          style={{ transformPerspective: 900 }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          className={cx(
            'glass flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            drag ? 'border-leaf-400 bg-leaf-500/10' : 'border-[var(--line-strong)] hover:border-leaf-500/60',
          )}
        >
          <div className="grid size-14 place-items-center rounded-2xl bg-leaf-500/15 text-leaf-400">
            <UploadCloud className="size-7" />
          </div>
          <div className="font-display text-lg font-bold">Drop files here, or tap to choose</div>
          <div className="text-[13px] text-leaf-200/65">PDF · JPG / PNG (text is read from the image) · Excel / CSV · MP3 / WAV · up to {MAX_MB} MB</div>
          <div className="text-[12px] text-leaf-200/50">Your uploads are always labelled as your documents, never mixed up with Vikaspedia content.</div>
          <input ref={input} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { if (e.target.files) handle(e.target.files); e.target.value = '' }} />
        </motion.div>
      </Rise>

      <Rise i={1} className="mt-4">
        <Panel
          title="Your documents"
          action={items.some((d) => d.status === 'indexed') && (
            <button onClick={() => navigate('/')} className="btn btn-ghost h-8 text-[12.5px]"><MessageSquare className="size-3.5" /> Ask about them</button>
          )}
        >
          {items.length === 0 ? (
            <EmptyState icon={<FileText className="size-5" />} title="Nothing uploaded yet">Uploads from this device will appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {items.map((d) => {
                const Icon = iconFor(d.name)
                return (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-500/12 text-leaf-400"><Icon className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="text-[12px] text-leaf-200/55">
                        {fmtSize(d.size)} · {new Date(d.at).toLocaleString()}
                        {d.status === 'failed' && d.error && <span className="text-red-300"> · {d.error}</span>}
                      </div>
                    </div>
                    {d.status === 'processing' && <span className="chip"><Spinner className="size-3" /> Reading</span>}
                    {d.status === 'indexed' && <span className="chip"><CheckCircle2 className="size-3" /> {d.chunks} passage{d.chunks === 1 ? '' : 's'}</span>}
                    {d.status === 'failed' && <span className="chip border-soil/30 text-red-300"><AlertCircle className="size-3" /> Failed</span>}
                    {d.status !== 'processing' && (
                      <button onClick={() => remove(d.id)} title="Remove from this list" aria-label={`Remove ${d.name} from list`} className="grid size-8 place-items-center rounded-lg text-leaf-200/50 hover:bg-soil/10 hover:text-red-300">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {items.length > 0 && <p className="mt-3 text-[12px] text-leaf-200/45">Removing an item only clears it from this list; the content stays searchable.</p>}
        </Panel>
      </Rise>
    </Page>
  )
}
