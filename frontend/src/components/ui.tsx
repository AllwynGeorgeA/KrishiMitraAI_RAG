import { useRef, type ReactNode, type HTMLAttributes } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, Check, HelpCircle, X, Loader2 } from 'lucide-react'
import type { Confidence, EligibilityStatus } from '../lib/api'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export { cx }

/** Card that tilts toward the pointer in 3D, with a light glare. Mouse only; static on touch. */
export function TiltCard({
  children,
  className,
  max = 8,
  onClick,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  max?: number
  onClick?: () => void
  as?: 'div' | 'button'
}) {
  const ref = useRef<HTMLDivElement & HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || reduce || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(8px)`
  }
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = ''
  }

  const Tag = as
  return (
    <Tag
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      className={cx(
        'glass group relative rounded-2xl text-left transition-[transform,box-shadow,border-color] duration-300 ease-out [transform-style:preserve-3d]',
        'hover:border-[var(--line-strong)] hover:shadow-[0_30px_60px_-24px_rgb(0_0_0/0.9),0_0_32px_-10px_rgb(34_197_94/0.35)]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <span className="tilt-glare pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {children}
    </Tag>
  )
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('glass rounded-2xl p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-[15px] font-bold text-leaf-50">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** Rises in from depth, staggered by index. */
export function Rise({ children, i = 0, className }: { children: ReactNode; i?: number; className?: string }) {
  return (
    <motion.div
      className={cx('min-w-0', className)}
      initial={{ opacity: 0, y: 24, rotateX: 12, z: -60 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, z: 0 }}
      transition={{ duration: 0.6, delay: Math.min(i, 12) * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ transformPerspective: 900 }}
    >
      {children}
    </motion.div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-leaf-50 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-leaf-200/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10', className)}>{children}</div>
}

const CONF: Record<Confidence, { label: string; cls: string; Icon: typeof Check }> = {
  high: { label: 'High confidence', cls: 'text-leaf-300 bg-leaf-500/12 border-leaf-500/30', Icon: Check },
  medium: { label: 'Medium confidence', cls: 'text-wheat bg-wheat/10 border-wheat/30', Icon: AlertTriangle },
  low: { label: 'Low confidence', cls: 'text-soil bg-soil/10 border-soil/30', Icon: X },
}

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const c = CONF[level] ?? CONF.low
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide', c.cls)}>
      <c.Icon className="size-3" strokeWidth={3} />
      {c.label}
    </span>
  )
}

export const VERDICT: Record<EligibilityStatus, { label: string; cls: string; Icon: typeof Check }> = {
  likely_eligible: { label: 'Likely eligible', cls: 'text-leaf-300 bg-leaf-500/12 border-leaf-500/30', Icon: Check },
  possibly_eligible: { label: 'Possibly eligible', cls: 'text-wheat bg-wheat/10 border-wheat/30', Icon: AlertTriangle },
  insufficient_information: { label: 'Need more info', cls: 'text-leaf-200 bg-white/5 border-white/15', Icon: HelpCircle },
  likely_not_eligible: { label: 'Likely not eligible', cls: 'text-soil bg-soil/10 border-soil/30', Icon: X },
}

export function VerdictBadge({ status }: { status: EligibilityStatus }) {
  const v = VERDICT[status] ?? VERDICT.insufficient_information
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold', v.cls)}>
      <v.Icon className="size-3" strokeWidth={3} />
      {v.label}
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-4 animate-spin', className)} />
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl border border-[var(--line)] bg-leaf-500/10 text-leaf-400">{icon}</div>
      <div className="font-display font-bold text-leaf-50">{title}</div>
      {children && <div className="max-w-sm text-sm text-leaf-200/70">{children}</div>}
    </div>
  )
}

export function ErrorNote({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className="rounded-xl border border-soil/30 bg-soil/10 px-4 py-3 text-sm text-red-200">
      {children}
    </div>
  )
}
