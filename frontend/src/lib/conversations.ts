// Shared conversation list (sidebar + chat page read the same data).
import { useEffect, useSyncExternalStore } from 'react'
import { api, type Conversation } from './api'

let list: Conversation[] = []
let loaded = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export async function refreshConversations() {
  try {
    list = await api.conversations()
  } catch {
    list = []
  }
  loaded = true
  emit()
}

export function useConversations() {
  const data = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => list,
  )
  useEffect(() => {
    if (!loaded) refreshConversations()
  }, [])
  return { conversations: data, loaded }
}

export type Bucket = 'Pinned' | 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older'

export function groupConversations(items: Conversation[]): [Bucket, Conversation[]][] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = 86_400_000
  const groups: Record<Bucket, Conversation[]> = { Pinned: [], Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] }
  for (const c of items) {
    const t = new Date(c.updated_at).getTime()
    const bucket: Bucket = c.pinned ? 'Pinned' : t >= today ? 'Today' : t >= today - day ? 'Yesterday' : t >= today - 7 * day ? 'Previous 7 days' : 'Older'
    groups[bucket].push(c)
  }
  return (Object.entries(groups) as [Bucket, Conversation[]][]).filter(([, v]) => v.length)
}
