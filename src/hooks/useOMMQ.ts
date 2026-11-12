import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AgentInfo,
  ModelInfo,
  OpenCodeClient,
  PermissionRequest,
  SessionInfo,
  SessionMessageInfo,
  V2Event,
} from '@opencode/client'
import type {
  BootState,
  ConnectResult,
  ConnectionConfig,
  CreateSessionInput,
  RecentEvent,
  RuntimeInfo,
  StreamState,
  Theme,
  ToastKind,
  ToastMessage,
} from '../lib/types'
import { createOpenCodeClient, describeError, isUnauthorized, normalizeBaseUrl } from '../lib/api'
import {
  clearConnection,
  clearPassword,
  loadConnection,
  loadTheme,
  saveConnection,
  saveTheme,
  setSkipAutoConnect,
  skipAutoConnect,
} from '../lib/storage'

const MAX_SESSIONS = 300
const MAX_MESSAGES = 200

const NOISY_EVENTS = new Set([
  'session.text.delta',
  'session.reasoning.delta',
  'session.tool.input.delta',
  'session.tool.progress',
  'session.compaction.delta',
  'session.step.streamed',
])

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

export function useOMMQ() {
  const initialConfig = useMemo(() => loadConnection(), [])
  const [connection, setConnection] = useState<ConnectionConfig | null>(initialConfig)
  const [client, setClient] = useState<OpenCodeClient | null>(null)
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)
  const [bootState, setBootState] = useState<BootState>('connecting')
  const [connectError, setConnectError] = useState<string | null>(null)

  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeSessionID, setActiveSessionID] = useState<string | null>(null)
  const [messages, setMessages] = useState<SessionMessageInfo[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [busySessions, setBusySessions] = useState<Set<string>>(new Set())
  const [permissions, setPermissions] = useState<PermissionRequest[]>([])
  const [streamState, setStreamState] = useState<StreamState>('offline')
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const [theme, setThemeState] = useState<Theme>(() => loadTheme())

  const runtimeRef = useRef<RuntimeInfo | null>(runtime)
  const configRef = useRef<ConnectionConfig | null>(connection)
  const clientRef = useRef<OpenCodeClient | null>(client)
  const activeRef = useRef<string | null>(activeSessionID)
  const sessionsRef = useRef<SessionInfo[]>(sessions)
  const connectGeneration = useRef(0)
  const messageRequest = useRef(0)
  const messageTimer = useRef<number | null>(null)
  const sessionTimer = useRef<number | null>(null)
  const toastSeq = useRef(0)
  const toastTimers = useRef<number[]>([])

  runtimeRef.current = runtime
  configRef.current = connection
  clientRef.current = client
  activeRef.current = activeSessionID
  sessionsRef.current = sessions

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    return () => {
      if (messageTimer.current) window.clearTimeout(messageTimer.current)
      if (sessionTimer.current) window.clearTimeout(sessionTimer.current)
      for (const timer of toastTimers.current) window.clearTimeout(timer)
    }
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (kind: ToastKind, title: string, detail?: string) => {
      const id = ++toastSeq.current
      setToasts((current) => [...current.slice(-4), { id, kind, title, detail }])
      const timer = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
      }, kind === 'error' ? 6500 : 4200)
      toastTimers.current.push(timer)
    },
    [],
  )

  /**
   * 401 means the stored credential is no longer accepted. Drop it, keep the
   * address/workspace so the connect screen is a one-field fix, and return to
   * the uplink. This avoids leaving the shell in a state where every write
   * silently fails.
   */
  const expireSession = useCallback((message: string) => {
    connectGeneration.current += 1
    clearPassword()
    setConnection((current) => (current ? { ...current, password: '' } : current))
    setClient(null)
    setRuntime(null)
    setSessions([])
    setSessionsLoading(false)
    setActiveSessionID(null)
    setMessages([])
    setMessagesLoading(false)
    setBusySessions(new Set())
    setPermissions([])
    setStreamState('offline')
    setLastEventAt(null)
    setRecentEvents([])
    setBootState('idle')
    setConnectError(message)
  }, [])

  const failAuth = useCallback(
    (error: unknown): boolean => {
      if (!isUnauthorized(error)) return false
      expireSession(
        '服务器拒绝了当前凭据：密码可能已变更，或服务重启后生成了新密码。请重新输入密码后连接。',
      )
      return true
    },
    [expireSession],
  )

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const markBusy = useCallback((sessionID: string, busy: boolean) => {
    setBusySessions((current) => {
      const next = new Set(current)
      if (busy) next.add(sessionID)
      else next.delete(sessionID)
      return next
    })
  }, [])

  const patchSession = useCallback((sessionID: string, patch: (session: SessionInfo) => SessionInfo) => {
    setSessions((current) => current.map((session) => (session.id === sessionID ? patch(session) : session)))
  }, [])

  const refreshSessions = useCallback(async (quiet = true): Promise<SessionInfo[]> => {
    const currentClient = clientRef.current
    if (!currentClient) return []
    if (!quiet) setSessionsLoading(true)
    try {
      const directory = configRef.current?.directory || undefined
      const result = await currentClient.session.list({
        limit: MAX_SESSIONS,
        order: 'desc',
        directory,
      })
      const next = result.data.filter((session) => !session.parentID)
      setSessions(next)
      setActiveSessionID((current) => {
        if (current && next.some((session) => session.id === current)) return current
        return next[0]?.id ?? null
      })
      return next
    } catch (error) {
      if (failAuth(error)) return []
      if (!quiet) notify('error', '会话列表加载失败', describeError(error))
      return []
    } finally {
      if (!quiet) setSessionsLoading(false)
    }
  }, [failAuth, notify])

  const refreshSessionsRef = useRef(refreshSessions)
  refreshSessionsRef.current = refreshSessions

  const loadMessages = useCallback(async (sessionID: string, quiet = false): Promise<void> => {
    const currentClient = clientRef.current
    if (!currentClient) return
    const token = ++messageRequest.current
    if (!quiet) setMessagesLoading(true)
    try {
      const result = await currentClient.message.list({
        sessionID,
        limit: MAX_MESSAGES,
        order: 'asc',
      })
      if (token === messageRequest.current && activeRef.current === sessionID) {
        setMessages(result.data)
      }
    } catch (error) {
      if (failAuth(error)) return
      if (!quiet && activeRef.current === sessionID) {
        notify('error', '消息加载失败', describeError(error))
      }
    } finally {
      if (token === messageRequest.current && !quiet) setMessagesLoading(false)
    }
  }, [failAuth, notify])

  const loadMessagesRef = useRef(loadMessages)
  loadMessagesRef.current = loadMessages

  const scheduleMessages = useCallback(
    (delay = 160) => {
      if (messageTimer.current) window.clearTimeout(messageTimer.current)
      messageTimer.current = window.setTimeout(() => {
        messageTimer.current = null
        if (activeRef.current) void loadMessagesRef.current(activeRef.current, true)
      }, delay)
    },
    [],
  )

  const scheduleSessions = useCallback((delay = 500) => {
    if (sessionTimer.current) window.clearTimeout(sessionTimer.current)
    sessionTimer.current = window.setTimeout(() => {
      sessionTimer.current = null
      void refreshSessionsRef.current(true)
    }, delay)
  }, [])

  const refreshPermissions = useCallback(async () => {
    const currentClient = clientRef.current
    if (!currentClient) return
    try {
      const directory = configRef.current?.directory || undefined
      const result = await currentClient.permission.request.list(
        directory ? { location: { directory } } : undefined,
      )
      setPermissions(result.data)
    } catch {
      // Permission polling is best-effort.
    }
  }, [])

  const connect = useCallback(
    async (input: ConnectionConfig): Promise<ConnectResult> => {
      const generation = ++connectGeneration.current
      const hadRuntime = Boolean(runtimeRef.current)
      const normalized: ConnectionConfig = {
        ...input,
        baseUrl: normalizeBaseUrl(input.baseUrl),
        directory: input.directory.trim(),
      }

      if (!normalized.baseUrl) {
        const error = '请输入 OpenCode 服务器地址。'
        setConnectError(error)
        setBootState(hadRuntime ? 'ready' : 'failed')
        return { ok: false, error }
      }

      setBootState('connecting')
      setConnectError(null)

      try {
        const nextClient = createOpenCodeClient(normalized)
        const infoStarted = performance.now()
        const server = await nextClient.server.info()
        const latency = performance.now() - infoStarted
        const location = await nextClient.location.get()
        const directory = normalized.directory || location.directory
        const locationInput = { directory }

        const [agentsOutput, modelsOutput, defaultOutput, permissionOutput, activeOutput, sessionsOutput] =
          await Promise.all([
            nextClient.agent.list({ location: locationInput }),
            nextClient.model.list({ types: ['chat'], location: locationInput }),
            nextClient.model.default({ location: locationInput }),
            nextClient.permission.request.list({ location: locationInput }),
            nextClient.session.active(),
            nextClient.session.list({ limit: MAX_SESSIONS, order: 'desc', directory }),
          ])

        if (generation !== connectGeneration.current) {
          return { ok: false, error: '连接已被新的请求取代。' }
        }

        const finalConfig: ConnectionConfig = { ...normalized, directory }
        const visibleSessions = sessionsOutput.data.filter((session) => !session.parentID)
        const nextRuntime: RuntimeInfo = {
          server,
          location,
          agents: agentsOutput.data,
          models: modelsOutput.data,
          defaultModel: defaultOutput.data,
          latency,
          connectedAt: Date.now(),
        }

        saveConnection(finalConfig)
        setConnection(finalConfig)
        setClient(nextClient)
        setRuntime(nextRuntime)
        setSessions(visibleSessions)
        setPermissions(permissionOutput.data)
        setBusySessions(
          new Set(
            Object.entries(activeOutput)
              .filter(([, value]) => value.type === 'running')
              .map(([sessionID]) => sessionID),
          ),
        )
        setActiveSessionID((current) => {
          if (current && visibleSessions.some((session) => session.id === current)) return current
          return visibleSessions[0]?.id ?? null
        })
        setRecentEvents([])
        setLastEventAt(null)
        setStreamState('connecting')
        setBootState('ready')
        setConnectError(null)
        notify(
          'success',
          '链路已建立',
          `版本 ${server.version} · ${Math.round(latency)}ms · ${visibleSessions.length} 条轨迹`,
        )
        return { ok: true }
      } catch (error) {
        if (generation !== connectGeneration.current) {
          return { ok: false, error: '连接已被新的请求取代。' }
        }
        const message = describeError(error)
        if (hadRuntime) {
          setBootState('ready')
          notify('error', '重新连接失败', message)
        } else {
          setBootState('failed')
          setConnectError(message)
        }
        return { ok: false, error: message }
      }
    },
    [notify],
  )

  useEffect(() => {
    if (!initialConfig) return
    void connect(initialConfig)
    // Auto-connect only on the first mount with a stored configuration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fresh install: if this origin already exposes an authenticated /api (the
  // local proxy injects the service credential for loopback clients), skip the
  // connection form and open straight into the console.
  useEffect(() => {
    if (initialConfig) return
    if (skipAutoConnect()) {
      setBootState('idle')
      return
    }

    const controller = new AbortController()
    const origin = window.location.origin

    const probe = async () => {
      setBootState('connecting')
      try {
        const response = await fetch(`${origin}/api/info`, {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        })
        const contentType = response.headers.get('content-type') ?? ''
        if (!response.ok || !contentType.includes('application/json')) throw new Error('probe failed')
        const info = (await response.json()) as { version?: unknown }
        if (typeof info.version !== 'string' || !info.version) throw new Error('probe failed')

        const config: ConnectionConfig = {
          baseUrl: origin,
          password: '',
          directory: '',
          remember: true,
        }
        setConnection(config)
        await connect(config)
      } catch {
        if (controller.signal.aborted) return
        setBootState('idle')
        setConnectError(null)
        setConnection(null)
      }
    }

    void probe()
    return () => controller.abort()
    // The probe runs once for a fresh install. A manual connection replaces it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConfig])

  const disconnect = useCallback(() => {
    connectGeneration.current += 1
    clearConnection()
    setSkipAutoConnect(true)
    setConnection(null)
    setClient(null)
    setRuntime(null)
    setSessions([])
    setSessionsLoading(false)
    setActiveSessionID(null)
    setMessages([])
    setMessagesLoading(false)
    setBusySessions(new Set())
    setPermissions([])
    setSearch('')
    setStreamState('offline')
    setLastEventAt(null)
    setRecentEvents([])
    setBootState('idle')
    setConnectError(null)
  }, [])

  useEffect(() => {
    if (!activeSessionID || !client) {
      setMessages([])
      setMessagesLoading(false)
      return
    }
    setMessages([])
    setMessagesLoading(true)
    void loadMessages(activeSessionID)
    return () => {
      messageRequest.current += 1
    }
  }, [activeSessionID, client, loadMessages])

  const handleEvent = useCallback(
    (event: V2Event) => {
      if (event.type === 'server.connected') return
      setLastEventAt(Date.now())
      if (!NOISY_EVENTS.has(event.type)) {
        setRecentEvents((current) => [{ id: event.id, type: event.type, at: Date.now() }, ...current].slice(0, 30))
      }

      const data = 'data' in event ? (event.data as { sessionID?: string }) : undefined
      const sessionID = typeof data?.sessionID === 'string' ? data.sessionID : undefined
      const isActive = Boolean(sessionID && sessionID === activeRef.current)

      switch (event.type) {
        case 'permission.asked': {
          const request: PermissionRequest = {
            id: event.data.id,
            sessionID: event.data.sessionID,
            action: event.data.action,
            resources: event.data.resources,
            save: event.data.save,
            metadata: event.data.metadata,
            source: event.data.source,
            message: event.data.message,
          }
          setPermissions((current) =>
            current.some((item) => item.id === request.id) ? current : [...current, request],
          )
          notify('info', '需要你的授权', event.data.message || event.data.action)
          break
        }
        case 'permission.replied': {
          setPermissions((current) => current.filter((item) => item.id !== event.data.requestID))
          if (isActive) scheduleMessages(240)
          break
        }
        case 'session.status': {
          if (sessionID) {
            markBusy(sessionID, event.data.status.type !== 'idle')
            if (isActive && event.data.status.type === 'retry') {
              notify('info', '模型暂时不可用，正在重试', event.data.status.message)
            }
          }
          break
        }
        case 'session.execution.started': {
          markBusy(event.data.sessionID, true)
          if (isActive) scheduleMessages(160)
          break
        }
        case 'session.execution.succeeded': {
          markBusy(event.data.sessionID, false)
          if (isActive) scheduleMessages(120)
          scheduleSessions(260)
          break
        }
        case 'session.execution.failed': {
          markBusy(event.data.sessionID, false)
          if (isActive) {
            scheduleMessages(120)
            notify('error', '执行失败', event.data.error.message)
          }
          scheduleSessions(260)
          break
        }
        case 'session.execution.interrupted': {
          markBusy(event.data.sessionID, false)
          if (isActive) scheduleMessages(120)
          scheduleSessions(260)
          break
        }
        case 'session.idle': {
          markBusy(event.data.sessionID, false)
          if (isActive) scheduleMessages(100)
          scheduleSessions(300)
          break
        }
        case 'session.retry.scheduled': {
          markBusy(event.data.sessionID, true)
          break
        }
        case 'session.text.started':
        case 'session.reasoning.started':
        case 'session.tool.input.started':
        case 'session.tool.called':
        case 'session.tool.success':
        case 'session.tool.failed':
        case 'session.step.started':
        case 'session.step.ended':
        case 'session.text.delta':
        case 'session.reasoning.delta':
        case 'session.text.ended':
        case 'session.reasoning.ended':
        case 'session.tool.input.ended':
        case 'session.tool.input.delta': {
          if (sessionID) markBusy(sessionID, true)
          if (isActive) scheduleMessages(event.type.endsWith('.delta') ? 170 : 100)
          break
        }
        case 'session.step.failed': {
          if (sessionID) markBusy(sessionID, false)
          if (isActive) scheduleMessages(100)
          break
        }
        case 'session.created': {
          if (event.data.parentID) break
          scheduleSessions(250)
          break
        }
        case 'session.renamed': {
          patchSession(event.data.sessionID, (session) => ({ ...session, title: event.data.title }))
          scheduleSessions(700)
          break
        }
        case 'session.deleted': {
          const deletedID = event.data.sessionID
          const remaining = sessionsRef.current.filter((session) => session.id !== deletedID)
          setSessions(remaining)
          if (activeRef.current === deletedID) {
            setActiveSessionID(remaining[0]?.id ?? null)
          }
          markBusy(deletedID, false)
          setPermissions((current) => current.filter((item) => item.sessionID !== deletedID))
          scheduleSessions(300)
          break
        }
        case 'session.agent.selected': {
          patchSession(event.data.sessionID, (session) => ({ ...session, agent: event.data.agent }))
          break
        }
        case 'session.model.selected': {
          patchSession(event.data.sessionID, (session) => ({ ...session, model: event.data.model }))
          break
        }
        case 'session.usage.updated': {
          patchSession(event.data.sessionID, (session) => ({
            ...session,
            cost: event.data.cost,
            tokens: event.data.tokens,
          }))
          break
        }
        case 'session.compaction.started':
        case 'session.compaction.ended':
        case 'session.compaction.failed': {
          if (isActive) scheduleMessages(180)
          break
        }
        case 'session.inbox.enqueued':
        case 'session.inbox.delivered': {
          if (isActive) scheduleMessages(160)
          break
        }
        case 'session.synthetic':
        case 'session.skill.activated': {
          if (isActive) scheduleMessages(200)
          break
        }
        default:
          break
      }
    },
    [markBusy, notify, patchSession, scheduleMessages, scheduleSessions],
  )

  useEffect(() => {
    if (!client) {
      setStreamState('offline')
      return
    }

    let stopped = false
    const controller = new AbortController()
    let attempt = 0

    const run = async () => {
      setStreamState('connecting')
      while (!stopped) {
        try {
          for await (const event of client.event.subscribe({ signal: controller.signal })) {
            if (stopped) break
            if (event.type === 'server.connected') {
              attempt = 0
              setStreamState('live')
              setLastEventAt(Date.now())
              void refreshSessionsRef.current(true)
              if (activeRef.current) void loadMessagesRef.current(activeRef.current, true)
              continue
            }
            handleEvent(event)
          }
          if (!stopped) setStreamState('reconnecting')
        } catch {
          if (!stopped) setStreamState('reconnecting')
        }

        if (stopped) break
        attempt += 1
        await wait(Math.min(1000 * 2 ** (attempt - 1), 10000), controller.signal)
      }
    }

    void run()

    return () => {
      stopped = true
      controller.abort()
    }
  }, [client, handleEvent])

  useEffect(() => {
    if (!client || streamState === 'live' || streamState === 'offline') return
    const interval = window.setInterval(() => {
      void refreshSessionsRef.current(true)
      if (activeRef.current) void loadMessagesRef.current(activeRef.current, true)
      void refreshPermissions()
    }, 5000)
    return () => window.clearInterval(interval)
  }, [client, streamState, refreshPermissions])

  const sendPrompt = useCallback(
    async (text: string, sessionID = activeRef.current): Promise<boolean> => {
      const currentClient = clientRef.current
      const value = text.trim()
      if (!currentClient || !sessionID || !value) return false
      markBusy(sessionID, true)
      try {
        await currentClient.session.prompt({ sessionID, text: value })
        scheduleMessages(120)
        scheduleSessions(400)
        return true
      } catch (error) {
        markBusy(sessionID, false)
        if (failAuth(error)) return false
        notify('error', '发送失败', describeError(error))
        return false
      }
    },
    [failAuth, markBusy, notify, scheduleMessages, scheduleSessions],
  )

  const interrupt = useCallback(async () => {
    const currentClient = clientRef.current
    const sessionID = activeRef.current
    if (!currentClient || !sessionID) return
    try {
      await currentClient.session.interrupt({ sessionID })
      notify('info', '已请求中断', 'OMMQ 将停止当前执行。')
      scheduleMessages(250)
    } catch (error) {
      if (failAuth(error)) return
      notify('error', '中断失败', describeError(error))
    }
  }, [failAuth, notify, scheduleMessages])

  const createSession = useCallback(
    async (input: CreateSessionInput): Promise<SessionInfo | null> => {
      const currentClient = clientRef.current
      if (!currentClient) return null
      try {
        const directory = input.directory?.trim() || configRef.current?.directory || undefined
        const session = await currentClient.session.create({
          title: input.title?.trim() || undefined,
          agent: input.agent || undefined,
          model: input.model,
          location: directory ? { directory } : undefined,
        })
        setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)])
        setActiveSessionID(session.id)
        scheduleSessions(600)
        return session
      } catch (error) {
        if (failAuth(error)) return null
        notify('error', '无法创建会话', describeError(error))
        return null
      }
    },
    [failAuth, notify, scheduleSessions],
  )

  const deleteSession = useCallback(
    async (sessionID: string): Promise<boolean> => {
      const currentClient = clientRef.current
      if (!currentClient) return false
      try {
        await currentClient.session.remove({ sessionID })
        const remaining = sessionsRef.current.filter((session) => session.id !== sessionID)
        setSessions(remaining)
        if (activeRef.current === sessionID) {
          setActiveSessionID(remaining[0]?.id ?? null)
        }
        markBusy(sessionID, false)
        notify('success', '会话已删除')
        return true
      } catch (error) {
        if (failAuth(error)) return false
        notify('error', '删除失败', describeError(error))
        return false
      }
    },
    [failAuth, markBusy, notify],
  )

  const switchAgent = useCallback(
    async (agent: string) => {
      const currentClient = clientRef.current
      const sessionID = activeRef.current
      if (!currentClient || !sessionID) return
      try {
        await currentClient.session.switchAgent({ sessionID, agent })
        patchSession(sessionID, (session) => ({ ...session, agent }))
      } catch (error) {
        if (failAuth(error)) return
        notify('error', '切换 Agent 失败', describeError(error))
      }
    },
    [failAuth, notify, patchSession],
  )

  const switchModel = useCallback(
    async (model: { id: string; providerID: string; variant?: string }) => {
      const currentClient = clientRef.current
      const sessionID = activeRef.current
      if (!currentClient || !sessionID) return
      try {
        await currentClient.session.switchModel({ sessionID, model })
        patchSession(sessionID, (session) => ({ ...session, model }))
      } catch (error) {
        if (failAuth(error)) return
        notify('error', '切换模型失败', describeError(error))
      }
    },
    [failAuth, notify, patchSession],
  )

  const replyPermission = useCallback(
    async (request: PermissionRequest, decision: 'once' | 'always' | 'reject') => {
      const currentClient = clientRef.current
      if (!currentClient) return
      try {
        await currentClient.permission.reply({
          sessionID: request.sessionID,
          requestID: request.id,
          decision,
        })
        setPermissions((current) => current.filter((item) => item.id !== request.id))
        notify(
          decision === 'reject' ? 'info' : 'success',
          decision === 'reject' ? '已拒绝请求' : '已授权',
          request.action,
        )
        if (request.sessionID === activeRef.current) scheduleMessages(260)
      } catch (error) {
        if (failAuth(error)) return
        notify('error', '授权回复失败', describeError(error))
        void refreshPermissions()
      }
    },
    [failAuth, notify, refreshPermissions, scheduleMessages],
  )

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshSessionsRef.current(true),
      activeRef.current ? loadMessagesRef.current(activeRef.current, true) : Promise.resolve(),
      refreshPermissions(),
    ])
  }, [refreshPermissions])

  const selectSession = useCallback((sessionID: string | null) => {
    setActiveSessionID(sessionID)
  }, [])

  const visibleSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sessions
    return sessions.filter((session) => {
      const haystack = [
        session.title,
        session.id,
        session.agent,
        session.model?.id,
        session.model?.providerID,
        session.location?.directory,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [sessions, search])

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionID) ?? null,
    [sessions, activeSessionID],
  )

  const activeBusy = activeSessionID ? busySessions.has(activeSessionID) : false

  return {
    connection,
    client,
    runtime,
    bootState,
    connectError,
    sessions,
    visibleSessions,
    sessionsLoading,
    search,
    setSearch,
    activeSession,
    activeSessionID,
    selectSession,
    messages,
    messagesLoading,
    busySessions,
    activeBusy,
    permissions,
    streamState,
    lastEventAt,
    recentEvents,
    toasts,
    theme,
    setTheme,
    toggleTheme,
    connect,
    disconnect,
    refreshAll,
    loadMessages: (sessionID: string, quiet = true) => loadMessagesRef.current(sessionID, quiet),
    sendPrompt,
    interrupt,
    createSession,
    deleteSession,
    switchAgent,
    switchModel,
    replyPermission,
    notify,
    dismissToast,
  }
}

export type OMMQController = ReturnType<typeof useOMMQ>

export type { AgentInfo, ModelInfo, PermissionRequest, SessionInfo, SessionMessageInfo }
