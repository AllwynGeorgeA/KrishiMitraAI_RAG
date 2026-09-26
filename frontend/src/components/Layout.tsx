import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3, BookOpen, ClipboardCheck, FileUp, LayoutDashboard, Menu, MessageSquare, Pencil, Pin, PinOff,
  Plus, Search, Sprout, Trash2, UserRound, X,
} from 'lucide-react'
import Scene3D from './Scene3D'
import { cx } from './ui'
import { api, type Health } from '../lib/api'
import { groupConversations, refreshConversations, useConversations } from '../lib/conversations'
import { useProfile } from '../lib/profile'

const NAV = [
  { to: '/', label: 'Chat', Icon: MessageSquare, end: true },
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/eligibility', label: 'Eligibility Checker', Icon: ClipboardCheck },
  { to: '/schemes', label: 'Schemes Library', Icon: BookOpen },
  { to: '/documents', label: 'Documents', Icon: FileUp },
  { to: '/insights', label: 'Insights', Icon: BarChart3 },
]

function useHealth() {
  const [health, setHealth] = useState<Health | null | 'offline'>(null)
  useEffect(() => {
    let alive = true
    const check = () => api.health().then((h) => alive && setHealth(h)).catch(() => alive && setHealth('offline'))
    check()
    const t = setInterval(check, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  return health
}

function History({ onNavigate }: { onNavigate: () => void }) {
  const { conversations, loaded } = useConversations()
  const activeId = useLocation().pathname.match(/^\/c\/([^/]+)/)?.[1]
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const shown = conversations.filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()))

  const rename = async (id: string, title: string) => {
    setEditing(null)
    if (title.trim()) {
      await api.renameConversation(id, title.trim()).catch(() => {})
      refreshConversations()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <label className="flex h-9 items-center gap-2 rounded-xl border border-[var(--line)] bg-black/25 px-3">
        <Search className="size-3.5 text-leaf-200/50" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search chats"
          className="w-full bg-transparent text-[13px] text-leaf-50 outline-none placeholder:text-leaf-200/40"
        />
      </label>
      <div className="-mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
        {loaded && shown.length === 0 && (
          <p className="px-2 py-2 text-xs text-leaf-200/50">{filter ? 'No matching chats.' : 'No chats yet. Ask something to start one.'}</p>
        )}
        {groupConversations(shown).map(([label, items]) => (
          <div key={label}>
            <div className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-leaf-200/45">{label}</div>
            {items.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  if (editing === c.id) return
                  navigate(`/c/${c.id}`)
                  onNavigate()
                }}
                className={cx(
                  'group flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] transition-colors',
                  c.id === activeId ? 'bg-leaf-500/15 text-leaf-300' : 'text-leaf-100/80 hover:bg-leaf-500/8',
                )}
              >
                {editing === c.id ? (
                  <input
                    autoFocus
                    defaultValue={c.title}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => rename(c.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    className="field h-7 px-2 text-[13px]"
                  />
                ) : (
                  <span className="flex-1 truncate" title={c.title}>{c.title}</span>
                )}
                {editing !== c.id && (
                  <span className="flex shrink-0 gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    {[
                      { Icon: Pencil, title: 'Rename', run: () => setEditing(c.id) },
                      {
                        Icon: c.pinned ? PinOff : Pin,
                        title: c.pinned ? 'Unpin' : 'Pin',
                        run: async () => { await api.pinConversation(c.id, !c.pinned).catch(() => {}); refreshConversations() },
                      },
                      {
                        Icon: Trash2,
                        title: 'Delete',
                        run: async () => {
                          await api.deleteConversation(c.id).catch(() => {})
                          if (c.id === activeId) navigate('/')
                          refreshConversations()
                        },
                      },
                    ].map(({ Icon, title, run }) => (
                      <button
                        key={title}
                        title={title}
                        aria-label={`${title} chat`}
                        onClick={(e) => { e.stopPropagation(); run() }}
                        className="grid size-6 place-items-center rounded-md text-leaf-200/60 hover:bg-leaf-500/15 hover:text-leaf-300"
                      >
                        <Icon className="size-3.5" />
                      </button>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate()
  const health = useHealth()
  const profile = useProfile()
  const initials = profile.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'KM'

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2.5 px-1">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-leaf-400 via-leaf-500 to-leaf-700 text-lg shadow-[0_0_18px_rgb(34_197_94/0.45)] transition-transform duration-700 [transform-style:preserve-3d] hover:[transform:perspective(300px)_rotateY(360deg)]">
          🌾
        </div>
        <div className="font-display text-[16px] font-extrabold tracking-tight">KrishiMitra AI</div>
      </div>

      <button
        onClick={() => { navigate('/'); onNavigate() }}
        className="btn btn-ghost h-10 w-full border-[var(--line-strong)] bg-gradient-to-br from-leaf-500/18 to-leaf-700/18"
      >
        <Plus className="size-4" /> New chat
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
                isActive ? 'bg-leaf-500/15 font-semibold text-leaf-300' : 'text-leaf-100/75 hover:bg-leaf-500/8 hover:text-leaf-300',
              )
            }
          >
            <Icon className="size-4" /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="h-px bg-[var(--line)]" />
      <History onNavigate={onNavigate} />

      <div className="rounded-xl border border-[var(--line)] bg-black/20 p-3 text-xs">
        <div className="mb-1 flex items-center gap-2 font-semibold text-leaf-100">
          <Sprout className="size-3.5 text-leaf-400" /> Knowledge base
          <span
            className={cx(
              'ml-auto size-2 rounded-full',
              health === null ? 'bg-leaf-200/30' : health === 'offline' || health.status !== 'ok' ? 'bg-soil' : 'bg-leaf-400 shadow-[0_0_8px_rgb(74_222_128)]',
            )}
          />
        </div>
        <div className="text-leaf-200/60">
          {health === null
            ? 'Connecting…'
            : health === 'offline'
              ? 'Server unreachable'
              : `${health.vector_store.chunks_indexed} passages · ${health.llm_configured ? 'AI answers on' : 'extract mode (no AI key)'}`}
        </div>
      </div>

      <NavLink
        to="/profile"
        onClick={onNavigate}
        className={({ isActive }) =>
          cx('flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-leaf-500/8', isActive && 'bg-leaf-500/12')
        }
      >
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-leaf-400 to-leaf-700 text-xs font-bold text-ink">{initials}</span>
        <span className="text-[13px] font-semibold">{profile.name || 'Farmer profile'}</span>
        <UserRound className="ml-auto size-4 text-leaf-200/50" />
      </NavLink>
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const close = () => setOpen(false)
  const pageKey = location.pathname.startsWith('/c/') ? '/' : location.pathname

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  return (
    <div className="flex h-dvh">
      <Scene3D />

      <aside className="glass-strong hidden w-[280px] shrink-0 border-y-0 border-l-0 md:block">
        <Sidebar onNavigate={() => {}} />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[86vw] border-r border-[var(--line)] bg-ink-2 shadow-2xl max-w-[320px] border-y-0 border-l-0 md:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <button onClick={close} aria-label="Close menu" className="absolute right-3 top-4 grid size-9 place-items-center rounded-lg text-leaf-200/70 hover:bg-leaf-500/10">
                <X className="size-5" />
              </button>
              <Sidebar onNavigate={close} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-strong flex h-14 shrink-0 items-center gap-3 border-x-0 border-t-0 px-3 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-xl text-leaf-100 hover:bg-leaf-500/10">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-extrabold">🌾 KrishiMitra AI</span>
        </header>

        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pageKey}
              className="h-full"
              initial={{ opacity: 0, z: -120, rotateX: 4 }}
              animate={{ opacity: 1, z: 0, rotateX: 0 }}
              exit={{ opacity: 0, z: 80 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ transformPerspective: 1400 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
