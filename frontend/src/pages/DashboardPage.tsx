import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, ClipboardCheck, Database, FileUp, MessageSquare, Network, ShieldCheck, Sprout, UserRound } from 'lucide-react'
import { EmptyState, ErrorNote, Page, PageHeader, Panel, Rise, TiltCard } from '../components/ui'
import { api } from '../lib/api'
import { useConversations } from '../lib/conversations'
import { profileCompleteness, useProfile } from '../lib/profile'
import { useApi } from '../lib/useApi'

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const profile = useProfile()
  const stats = useApi(api.stats)
  const insights = useApi(() => api.insights(7))
  const { conversations } = useConversations()
  const completeness = profileCompleteness(profile)

  const tiles = [
    { label: 'Questions this week', value: insights.data?.questions, Icon: MessageSquare, sub: insights.data ? `${insights.data.answered} answered from sources` : '' },
    { label: 'Schemes in knowledge graph', value: stats.data?.schemes_in_graph, Icon: Sprout, sub: 'Linked to crops, states & benefits' },
    { label: 'Source passages indexed', value: stats.data?.chunks_indexed, Icon: Database, sub: stats.data ? `${stats.data.documents_in_graph} documents` : '' },
    { label: 'Graph connections', value: stats.data?.graph_edges, Icon: Network, sub: stats.data ? `${stats.data.graph_nodes} entities` : '' },
  ]

  const actions = [
    { to: '/', label: 'Ask the assistant', Icon: MessageSquare },
    { to: '/eligibility', label: 'Check my eligibility', Icon: ClipboardCheck },
    { to: '/documents', label: 'Upload a document', Icon: FileUp },
    { to: '/schemes', label: 'Browse all schemes', Icon: BookOpen },
  ]

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Your farming assistant at a glance" />
      {stats.error && <div className="mb-4"><ErrorNote>{stats.error}</ErrorNote></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, Icon, sub }, i) => (
          <Rise key={label} i={i}>
            <TiltCard className="h-full p-4 sm:p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-leaf-500/15 text-leaf-400"><Icon className="size-[18px]" /></span>
              <div className="mt-3 font-display text-3xl font-extrabold tabular-nums">{value ?? '–'}</div>
              <div className="mt-0.5 text-[13px] font-medium text-leaf-100/80">{label}</div>
              {sub && <div className="mt-1 text-[12px] text-leaf-200/55">{sub}</div>}
            </TiltCard>
          </Rise>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Rise i={4}>
          <Panel title="Recent conversations" action={<Link to="/" className="text-[13px] font-semibold text-leaf-400 hover:text-leaf-300">New chat →</Link>}>
            {conversations.length === 0 ? (
              <EmptyState icon={<MessageSquare className="size-5" />} title="No conversations yet">
                Ask your first question and it will show up here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {conversations.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => navigate(`/c/${c.id}`)} className="flex w-full items-center gap-3 py-2.5 text-left hover:text-leaf-300">
                      <span className="size-1.5 shrink-0 rounded-full bg-leaf-400" />
                      <span className="flex-1 truncate text-sm">{c.title}</span>
                      <span className="shrink-0 text-[12px] text-leaf-200/50">{timeAgo(c.updated_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Rise>

        <div className="flex flex-col gap-4">
          <Rise i={5}>
            <Panel title="Quick actions">
              <div className="grid gap-2">
                {actions.map(({ to, label, Icon }) => (
                  <Link key={to} to={to} className="btn btn-ghost h-11 justify-start">
                    <Icon className="size-4 text-leaf-400" /> {label}
                  </Link>
                ))}
              </div>
            </Panel>
          </Rise>
          <Rise i={6}>
            <Panel title="Your profile">
              <div className="flex items-center gap-3">
                <UserRound className="size-5 text-leaf-400" />
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-black/30">
                    <div className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-leaf-300 transition-all duration-700" style={{ width: `${completeness}%` }} />
                  </div>
                  <div className="mt-1.5 text-[12px] text-leaf-200/65">{completeness}% complete · used for eligibility checks</div>
                </div>
              </div>
              <Link to="/profile" className="btn btn-ghost mt-3 h-9 w-full">{completeness === 100 ? 'Edit profile' : 'Complete profile'}</Link>
            </Panel>
          </Rise>
        </div>
      </div>

      <Rise i={7} className="mt-4">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-black/20 p-4 text-[13px] text-leaf-200/70">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-leaf-400" />
          Every answer is built only from indexed government sources (Vikaspedia and documents you upload). Claims without a source are removed before you see them.
        </div>
      </Rise>
    </Page>
  )
}
