import { useEffect, useState } from 'react'
import type { SessionInfo } from '@opencode/client'
import { WifiOff } from 'lucide-react'
import { useOMMQ } from './hooks/useOMMQ'
import { defaultBaseUrl } from './lib/storage'
import { primaryAgents } from './lib/api'
import { sessionTitle } from './lib/format'
import type { CreateSessionInput } from './lib/types'
import { OMMQBackground } from './components/OMMQBackground'
import { BootScreen } from './components/BootScreen'
import { Composer } from './components/Composer'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ConnectScreen } from './components/ConnectScreen'
import { EmptyState } from './components/EmptyState'
import { Inspector } from './components/Inspector'
import { NewSessionDialog } from './components/NewSessionDialog'
import { PermissionDock } from './components/PermissionDock'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { Toasts } from './components/Toasts'
import { TopBar } from './components/TopBar'

function App() {
  const OMMQ = useOMMQ()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth >= 1180)
  const [newSessionOpen, setNewSessionOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SessionInfo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [focusToken, setFocusToken] = useState(0)
  const [quickStarting, setQuickStarting] = useState(false)

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true
      const dialogOpen = Boolean(document.querySelector('.dialog-layer'))

      if (event.key === 'Escape') {
        setSidebarOpen(false)
        return
      }
      if (dialogOpen) return

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setNewSessionOpen(true)
        setSidebarOpen(false)
      }
      if (event.key === '/' && !typing) {
        event.preventDefault()
        document.getElementById('session-search')?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // A 401 sends the app back to the connect screen. Reset transient overlays so
  // they do not pop back up after the user reconnects.
  useEffect(() => {
    if (OMMQ.runtime) return
    setSidebarOpen(false)
    setNewSessionOpen(false)
    setSettingsOpen(false)
    setDeleteTarget(null)
  }, [OMMQ.runtime])

  if (!OMMQ.runtime || !OMMQ.client) {
    if (OMMQ.bootState === 'connecting') {
      return <BootScreen baseUrl={OMMQ.connection?.baseUrl || defaultBaseUrl()} />
    }
    return (
      <ConnectScreen
        initial={OMMQ.connection}
        defaultUrl={OMMQ.connection?.baseUrl || defaultBaseUrl()}
        bootState={OMMQ.bootState}
        externalError={OMMQ.connectError}
        theme={OMMQ.theme}
        onToggleTheme={OMMQ.toggleTheme}
        onConnect={OMMQ.connect}
      />
    )
  }

  const runtime = OMMQ.runtime
  const connection = OMMQ.connection
  const activeSession = OMMQ.activeSession
  const workspace = connection?.directory || runtime.location.directory
  const agents = primaryAgents(runtime.agents)
  const defaultAgent = activeSession?.agent ?? agents.find((agent) => agent.id === 'build')?.id ?? agents[0]?.id
  const defaultModel = activeSession?.model ?? (runtime.defaultModel
    ? { id: runtime.defaultModel.id, providerID: runtime.defaultModel.providerID }
    : undefined)

  const handleCreateSession = async (input: CreateSessionInput): Promise<SessionInfo | null> => {
    const session = await OMMQ.createSession(input)
    if (session) {
      setFocusToken((current) => current + 1)
      OMMQ.notify('success', '会话已创建', sessionTitle(session))
    }
    return session
  }

  const handleQuickStart = async (prompt: string) => {
    if (quickStarting) return
    setQuickStarting(true)
    try {
      const agent = agents.find((item) => item.id === 'build') ?? agents[0]
      const model = runtime.defaultModel
        ? { id: runtime.defaultModel.id, providerID: runtime.defaultModel.providerID }
        : undefined
      const session = await OMMQ.createSession({
        agent: agent?.id,
        model,
        directory: connection?.directory,
      })
      if (session) {
        setFocusToken((current) => current + 1)
        await OMMQ.sendPrompt(prompt, session.id)
      }
    } finally {
      setQuickStarting(false)
    }
  }

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await OMMQ.refreshAll()
      OMMQ.notify('info', '数据已同步', '会话、消息与授权队列已刷新。')
    } finally {
      setRefreshing(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const ok = await OMMQ.deleteSession(deleteTarget.id)
      if (ok) setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`app-shell ${inspectorOpen ? 'with-inspector' : ''}`.trim()}>
      <OMMQBackground />

      <Sidebar
        runtime={runtime}
        connection={connection}
        sessions={OMMQ.visibleSessions}
        activeSessionID={OMMQ.activeSessionID}
        busySessions={OMMQ.busySessions}
        search={OMMQ.search}
        streamState={OMMQ.streamState}
        onSearch={OMMQ.setSearch}
        onSelect={(sessionID) => {
          OMMQ.selectSession(sessionID)
          setSidebarOpen(false)
        }}
        onNew={() => {
          setNewSessionOpen(true)
          setSidebarOpen(false)
        }}
        onDelete={setDeleteTarget}
        onOpenSettings={() => {
          setSettingsOpen(true)
          setSidebarOpen(false)
        }}
        onCloseMobile={() => setSidebarOpen(false)}
        mobileOpen={sidebarOpen}
      />

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭侧栏"
        />
      )}

      <main className="workspace">
        <TopBar
          session={activeSession}
          busy={OMMQ.activeBusy}
          streamState={OMMQ.streamState}
          theme={OMMQ.theme}
          inspectorOpen={inspectorOpen}
          onMenu={() => setSidebarOpen(true)}
          onRefresh={() => void handleRefresh()}
          onToggleInspector={() => setInspectorOpen((current) => !current)}
          onToggleTheme={OMMQ.toggleTheme}
          refreshing={refreshing}
        />

        {OMMQ.streamState === 'reconnecting' && (
          <div className="stream-banner" role="status">
            <WifiOff size={14} />
            <span>实时事件流中断，正在自动重连</span>
            <small>数据将每 5 秒轮询</small>
          </div>
        )}

        {activeSession ? (
          <>
            <Timeline
              messages={OMMQ.messages}
              session={activeSession}
              models={runtime.models}
              busy={OMMQ.activeBusy}
              loading={OMMQ.messagesLoading}
              streamState={OMMQ.streamState}
            />
            <Composer
              key={activeSession.id}
              session={activeSession}
              agents={runtime.agents}
              models={runtime.models}
              busy={OMMQ.activeBusy}
              focusToken={focusToken}
              onSend={(text) => OMMQ.sendPrompt(text)}
              onStop={() => void OMMQ.interrupt()}
              onSwitchAgent={(agent) => void OMMQ.switchAgent(agent)}
              onSwitchModel={(model) => void OMMQ.switchModel(model)}
            />
          </>
        ) : (
          <EmptyState
            runtime={runtime}
            workspace={workspace}
            quickStarting={quickStarting}
            onNew={() => setNewSessionOpen(true)}
            onQuickStart={(prompt) => void handleQuickStart(prompt)}
          />
        )}
      </main>

      {inspectorOpen && (
        <Inspector
          session={activeSession}
          messages={OMMQ.messages}
          runtime={runtime}
          connection={connection}
          streamState={OMMQ.streamState}
          lastEventAt={OMMQ.lastEventAt}
          recentEvents={OMMQ.recentEvents}
          busy={OMMQ.activeBusy}
          onClose={() => setInspectorOpen(false)}
          onRefresh={() => void handleRefresh()}
          onDelete={setDeleteTarget}
          onOpenSettings={() => setSettingsOpen(true)}
          notify={OMMQ.notify}
        />
      )}

      <PermissionDock
        permissions={OMMQ.permissions}
        sessions={OMMQ.sessions}
        onReply={OMMQ.replyPermission}
      />

      <Toasts toasts={OMMQ.toasts} onDismiss={OMMQ.dismissToast} />

      {newSessionOpen && (
        <NewSessionDialog
          runtime={runtime}
          defaults={{
            agent: defaultAgent,
            model: defaultModel,
            directory: workspace,
          }}
          onClose={() => setNewSessionOpen(false)}
          onCreate={handleCreateSession}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          runtime={runtime}
          connection={connection}
          theme={OMMQ.theme}
          onClose={() => setSettingsOpen(false)}
          onConnect={OMMQ.connect}
          onDisconnect={OMMQ.disconnect}
          onTheme={OMMQ.setTheme}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="删除这条会话？"
          description={`「${sessionTitle(deleteTarget)}」及其消息记录将从 OpenCode 服务器中移除，此操作不可撤销。`}
          confirmLabel="删除会话"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  )
}

export default App
