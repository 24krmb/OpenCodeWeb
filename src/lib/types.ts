import type {
  AgentInfo,
  LocationPublicInfo,
  ModelInfo,
  PermissionRequest,
  ServerInfo,
  SessionInfo,
  SessionMessageInfo,
} from '@opencode/client'

export type Theme = 'dark' | 'light'

export type StreamState = 'connecting' | 'live' | 'reconnecting' | 'offline'

export type BootState = 'idle' | 'connecting' | 'ready' | 'failed'

export type ConnectionConfig = {
  baseUrl: string
  password: string
  directory: string
  remember: boolean
}

export type RuntimeInfo = {
  server: ServerInfo
  location: LocationPublicInfo
  agents: AgentInfo[]
  models: ModelInfo[]
  defaultModel: ModelInfo | null
  latency: number
  connectedAt: number
}

export type ToastKind = 'success' | 'error' | 'info'

export type ToastMessage = {
  id: number
  kind: ToastKind
  title: string
  detail?: string
}

export type RecentEvent = {
  id: string
  type: string
  at: number
}

export type ConnectResult = {
  ok: boolean
  error?: string
}

export type SessionBundle = {
  session: SessionInfo
  messages: SessionMessageInfo[]
}

export type PermissionLite = PermissionRequest

export type CreateSessionInput = {
  title?: string
  agent?: string
  model?: {
    id: string
    providerID: string
    variant?: string
  }
  directory?: string
}
