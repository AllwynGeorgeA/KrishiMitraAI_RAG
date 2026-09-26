import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, CreditCard, Globe, Paperclip, Sprout, TrendingUp, UserRound } from 'lucide-react'
import AnswerCard from '../components/AnswerCard'
import { TiltCard, cx } from '../components/ui'
import { api, ApiError, type ChatResponse } from '../lib/api'
import { refreshConversations } from '../lib/conversations'
import { toApiProfile, useProfile } from '../lib/profile'

type Msg =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'bot'; id: string; data: ChatResponse }
  | { kind: 'note'; id: string; text: string; error?: boolean; pending?: boolean }

const SUGGESTIONS = [
  { q: 'What schemes are available for small and marginal farmers?', Icon: TrendingUp },
  { q: 'Am I eligible for PM-KISAN? I have 2 acres in Uttar Pradesh.', Icon: Sprout },
  { q: 'How do I apply for the Kisan Credit Card?', Icon: CreditCard },
]
const THINKING = ['Searching the knowledge base…', 'Checking eligibility rules…', 'Verifying every citation…', 'Almost there…']
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.wav,.mp3,.m4a'
const uid = () => Math.random().toString(36).slice(2, 10)

const errorResponse = (answer: string): ChatResponse => ({
  answer, relevant: false, confidence: 'low', schemes: [], missing_information: [], follow_up_questions: [], evidence: [], refused: true,
})

function Thinking() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % THINKING.length), 1400)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="glass inline-flex items-center gap-3 rounded-2xl rounded-tl-md px-4 py-3">
      <span className="flex gap-1">
        {[0, 1, 2].map((d) => <span key={d} className="typing-dot size-1.5 rounded-full bg-leaf-400" />)}
      </span>
      <span className="text-[13px] text-leaf-200/80">{THINKING[i]}</span>
    </div>
  )
}

export default function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profile = useProfile()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [placeholder, setPlaceholder] = useState('Ask about any farm scheme…')
  const [busy, setBusy] = useState(false)
  const [webSearch, setWebSearch] = useState(profile.webSearch)
  const [atBottom, setAtBottom] = useState(true)
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Set when we create a conversation mid-send, so the route change to /c/:id
  // doesn't reload from the server and wipe the in-flight message.
  const createdHere = useRef<string | null>(null)
  const location = useLocation()
  const askedFromElsewhere = useRef(false)

  useEffect(() => {
    if (!id) {
      setMessages([])
      return
    }
    if (createdHere.current === id) return
    let alive = true
    api
      .conversation(id)
      .then((conv) => {
        if (!alive) return
        setMessages(
          conv.messages.map((m): Msg =>
            m.role === 'user'
              ? { kind: 'user', id: m.id, text: m.content }
              : { kind: 'bot', id: m.id, data: m.response ?? { ...errorResponse(m.content), refused: false } },
          ),
        )
      })
      .catch(() => alive && navigate('/', { replace: true }))
    return () => {
      alive = false
    }
  }, [id, navigate])

  const scrollToBottom = (smooth = true) =>
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }))

  useEffect(() => {
    scrollToBottom(false)
  }, [messages.length, busy])

  const onScroll = () => {
    const el = scroller.current
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 200)
  }

  const ensureConversation = async () => {
    if (id) return id
    const conv = await api.createConversation()
    createdHere.current = conv.id
    navigate(`/c/${conv.id}`, { replace: true })
    return conv.id
  }

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')
    setPlaceholder('Ask about any farm scheme…')
    setMessages((m) => [...m, { kind: 'user', id: uid(), text }])
    setBusy(true)
    try {
      const convId = await ensureConversation()
      const data = await api.sendMessage(convId, text, toApiProfile(profile), webSearch)
      setMessages((m) => [...m, { kind: 'bot', id: uid(), data }])
      refreshConversations()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
      setMessages((m) => [...m, { kind: 'bot', id: uid(), data: errorResponse(msg) }])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const upload = async (file: File) => {
    const noteId = uid()
    setMessages((m) => [...m, { kind: 'note', id: noteId, text: `Reading ${file.name}…`, pending: true }])
    const update = (text: string, error = false) =>
      setMessages((m) => m.map((x) => (x.id === noteId ? { kind: 'note', id: noteId, text, error } : x)))
    try {
      const r = await api.upload(file)
      update(`📎 ${file.name} added (${r.chunks_created} passage${r.chunks_created === 1 ? '' : 's'}). It's marked as your document, not Vikaspedia. Ask a question about it.`)
    } catch (e) {
      update(`Couldn't add ${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`, true)
    }
  }

  // Other pages (e.g. the Schemes Library) can open a new chat with a question: navigate('/', { state: { ask } }).
  useEffect(() => {
    const ask = (location.state as { ask?: string } | null)?.ask
    if (ask && !id && !askedFromElsewhere.current) {
      askedFromElsewhere.current = true
      navigate('.', { replace: true, state: null })
      send(ask)
    }
  }, [location.state])

  // Follow-up chips are the assistant ASKING the user for info ("Which state?"),
  // so clicking one prompts the user to answer rather than re-sending the question.
  const onFollowUp = (q: string) => {
    setInput('')
    setPlaceholder(`Your answer: ${q}`)
    inputRef.current?.focus()
  }

  const profileBits = [profile.state, profile.crop, profile.landAcres && `${profile.landAcres} acres`, profile.farmerType].filter(Boolean)
  const started = messages.length > 0

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {!started ? (
          <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center">
            <TributeStrip />
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-leaf-200/60">
              Welcome to KrishiMitra AI
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20, rotateX: 20 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ transformPerspective: 800 }}
              className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl"
            >
              How can I help with
              <br />
              <span className="bg-gradient-to-r from-leaf-300 via-leaf-400 to-leaf-600 bg-clip-text text-transparent">your farming</span> today?
            </motion.h1>
            <p className="mt-3 max-w-lg text-sm text-leaf-200/70">
              Answers come only from verified government scheme sources, with citations you can check.
            </p>
            <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
              {SUGGESTIONS.map(({ q, Icon }, i) => (
                <motion.div key={q} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.08 }}>
                  <TiltCard as="button" onClick={() => send(q)} className="flex h-full w-full flex-col gap-3 p-4">
                    <span className="grid size-8 place-items-center rounded-lg bg-leaf-500/15 text-leaf-400"><Icon className="size-4" /></span>
                    <span className="text-[13.5px] font-medium leading-snug text-leaf-50">{q}</span>
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:py-8">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 14, rotateX: 8, z: -40 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0, z: 0 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                  style={{ transformPerspective: 700 }}
                  className={cx('flex', m.kind === 'user' ? 'justify-end' : m.kind === 'note' ? 'justify-center' : 'justify-start')}
                >
                  {m.kind === 'user' && (
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-gradient-to-br from-leaf-500 to-leaf-700 px-4 py-2.5 text-[14.5px] text-white shadow-[0_10px_30px_-12px_rgb(34_197_94/0.6)]">
                      {m.text}
                    </div>
                  )}
                  {m.kind === 'bot' && <AnswerCard data={m.data} onFollowUp={onFollowUp} />}
                  {m.kind === 'note' && (
                    <div className={cx('rounded-full border px-4 py-1.5 text-[12.5px]', m.error ? 'border-soil/30 bg-soil/10 text-red-200' : 'border-[var(--line)] bg-black/30 text-leaf-200/80')}>
                      {m.pending && <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-leaf-400" />}
                      {m.text}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {busy && <Thinking />}
          </div>
        )}
      </div>

      {started && !atBottom && (
        <button
          onClick={() => scrollToBottom()}
          aria-label="Scroll to latest"
          className="glass absolute bottom-32 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full text-leaf-300"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-[12px] text-leaf-200/60">
            {profileBits.length ? (
              <Link to="/profile" className="chip hover:border-[var(--line-strong)]"><UserRound className="size-3" /> Answering for: {profileBits.join(' · ')}</Link>
            ) : (
              <Link to="/profile" className="hover:text-leaf-300">Add your state, crop and land size for personal eligibility checks →</Link>
            )}
          </div>
          <div className={cx('glass flex items-end gap-1.5 rounded-2xl p-2 transition-shadow focus-within:border-[var(--line-strong)] focus-within:shadow-[0_0_0_3px_rgb(34_197_94/0.12)]', busy && 'opacity-80')}>
            <button onClick={() => fileRef.current?.click()} title="Attach a document (PDF, image, spreadsheet, audio)" aria-label="Attach a document" className="grid size-10 shrink-0 place-items-center rounded-xl text-leaf-200/70 hover:bg-leaf-500/12 hover:text-leaf-300">
              <Paperclip className="size-[18px]" />
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) upload(f)
              }}
            />
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              disabled={busy}
              placeholder={placeholder}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[14.5px] text-leaf-50 outline-none placeholder:text-leaf-200/40"
            />
            <button
              onClick={() => setWebSearch((v) => !v)}
              title={webSearch ? 'Live web search ON (unverified, shown separately)' : 'Add live web results (unverified, shown separately)'}
              aria-pressed={webSearch}
              aria-label="Toggle live web search"
              className={cx('grid size-10 shrink-0 place-items-center rounded-xl transition-colors', webSearch ? 'bg-wheat/15 text-wheat' : 'text-leaf-200/70 hover:bg-leaf-500/12 hover:text-leaf-300')}
            >
              <Globe className="size-[18px]" />
            </button>
            <button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send" className="btn btn-primary size-10 shrink-0 p-0">
              <ArrowUp className="size-5" strokeWidth={2.5} />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-leaf-200/40">
            Enter to send · Shift+Enter for a new line{webSearch && ' · live web results on (unverified)'}
          </p>
        </div>
      </div>
    </div>
  )
}

function TributeStrip() {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return (
    <div className="mb-6 flex items-center gap-3 rounded-full border border-[var(--line)] bg-black/25 py-1.5 pl-1.5 pr-4 text-left text-[12px] text-leaf-200/75">
      <img src={`${import.meta.env.BASE_URL}nammalvar.jpg`} alt="Dr. G. Nammalvar" onError={() => setOk(false)} className="size-9 rounded-full object-cover" />
      <span>
        In memory of <strong className="text-leaf-100">Dr. G. Nammalvar</strong>: "Agriculture is not business… it's a way of life."
      </span>
    </div>
  )
}
