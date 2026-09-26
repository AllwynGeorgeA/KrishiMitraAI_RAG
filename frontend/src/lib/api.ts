// Typed client for the FastAPI backend. Types mirror app/llm/schemas.py.

export type Confidence = 'high' | 'medium' | 'low'
export type EligibilityStatus =
  | 'likely_eligible'
  | 'possibly_eligible'
  | 'insufficient_information'
  | 'likely_not_eligible'
export type SourceType = 'vikaspedia' | 'trusted_document' | 'user_upload'

export interface FarmerProfile {
  state?: string | null
  district?: string | null
  crop?: string | null
  land_size_hectares?: number | null
  farmer_type?: string | null
  irrigation?: string | null
  category?: string | null
}

export interface SchemeMatch {
  scheme_name: string
  match_strength: 'strong' | 'moderate' | 'weak'
  why_it_matches: string
  benefits: string[]
  eligibility_points: string[]
  missing_information: string[]
  eligibility_status: EligibilityStatus
  eligibility_explanation: string
  next_step: string
  citations: string[]
  source_type: SourceType
}

export interface EvidenceChunk {
  chunk_id: string
  document_id: string
  title: string
  section: string
  source_url: string
  source_type: SourceType
  text: string
  final_score: number
}

export interface TrustCheck {
  evidence_found: boolean
  source_verified: boolean
  hallucination_checked: boolean
  claims_removed: number
  eligibility_complete: boolean
  confidence: Confidence
}

export interface WebResult {
  title: string
  url: string
  snippet: string
}

export interface ChatResponse {
  answer: string
  relevant: boolean
  confidence: Confidence
  schemes: SchemeMatch[]
  missing_information: string[]
  follow_up_questions: string[]
  evidence: EvidenceChunk[]
  trust_check?: TrustCheck
  refused: boolean
  refusal_reason?: string | null
  guardrail_triggered?: string | null
  web_search_used?: boolean
  web_results?: WebResult[]
}

export interface Conversation {
  id: string
  title: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  response: ChatResponse | null
  created_at: string
}

export interface Health {
  status: 'ok' | 'degraded'
  demo_mode: boolean
  vector_store: { ok: boolean; chunks_indexed: number }
  knowledge_graph: { ok: boolean; nodes: number }
  llm_configured: boolean
}

export interface Stats {
  chunks_indexed: number
  schemes_in_graph: number
  documents_in_graph: number
  graph_nodes: number
  graph_edges: number
  known_crops_tracked: number
}

export interface Insights {
  days: number
  conversations: number
  questions: number
  answered: number
  claims_removed: number
  confidence: Record<Confidence, number>
  guardrails: Record<string, number>
  top_schemes: { name: string; count: number }[]
  questions_per_day: { date: string; questions: number }[]
}

export interface UploadResult {
  filename: string
  documents_created: number
  chunks_created: number
  message: string
}

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError('Could not reach the KrishiMitra server. Check that it is running.')
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail)
  }
  return res.json() as Promise<T>
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  health: () => request<Health>('/health'),
  stats: () => request<Stats>('/stats'),
  schemes: () => request<{ count: number; schemes: { name: string; node_id: string }[] }>('/schemes'),
  insights: (days: number) => request<Insights>(`/conversations/insights?days=${days}`),

  conversations: () => request<Conversation[]>('/conversations'),
  conversation: (id: string) => request<Conversation & { messages: StoredMessage[] }>(`/conversations/${id}`),
  createConversation: () => request<Conversation>('/conversations', json('POST', {})),
  renameConversation: (id: string, title: string) => request(`/conversations/${id}`, json('PATCH', { title })),
  pinConversation: (id: string, pinned: boolean) => request(`/conversations/${id}/pin`, json('PATCH', { pinned })),
  deleteConversation: (id: string) => request(`/conversations/${id}`, { method: 'DELETE' }),
  sendMessage: (id: string, query: string, profile: FarmerProfile | null, webSearch: boolean) =>
    request<ChatResponse>(`/conversations/${id}/messages`, json('POST', { query, profile, web_search: webSearch })),

  chat: (query: string, profile: FarmerProfile | null) => request<ChatResponse>('/chat', json('POST', { query, profile })),
  compare: (names: string[], profile: FarmerProfile | null) =>
    request<{ comparison: { scheme_name: string; response: ChatResponse }[] }>(
      '/scheme/compare',
      json('POST', { scheme_names: names, profile }),
    ),

  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<UploadResult>('/upload', { method: 'POST', body: form })
  },
}
