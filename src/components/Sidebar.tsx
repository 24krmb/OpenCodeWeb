import { useMemo } from 'react'
import type { SessionInfo } from '@opencode/client'
import {
  Folder,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import type { ConnectionConfig, RuntimeInfo, StreamState } from '../lib/types'
import { findModel } from '../lib/api'
import { basename, dayLabel, relativeTime, sessionTitle } from '../lib/format'
import { Brand } from './Brand'

type SidebarProps = {
  runtime: RuntimeInfo
  connection: ConnectionConfig | null
  sessions: SessionInfo[]
  activeSessionID: string | null
  busySessions: Set<string>
  search: string
  streamState: StreamState
  onSearch: (value: string) => void
  onSelect: (sessionID: string) => void
  onNew: () => void
  onDelete: (session: SessionInfo) => void
  onOpenSettings: () => void
  onCloseMobile: () => void
  mobileOpen: boolean
}

const STREAM_LABEL: Record<StreamState, string> = {
  live: '实时链路',
  connecting: '建立链路',
  reconnecting: '重连中',
  offline: '已离线',
}

export function Sidebar({
  runtime,
  connection,
  sessions,
  activeSessionID,
  busySessions,
  search,
  streamState,
  onSearch,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  onCloseMobile,
  mobileOpen,
}: SidebarProps) {
  const groups = useMemo(() => {
    const map = new Map<string, SessionInfo[]>()
    for (const session of sessions) {
      const label = dayLabel(session.time.updated || session.time.created)
      const bucket = map.get(label)
      if (bucket) bucket.push(session)
      else map.set(label, [session])
    }
    return [...map.entries()]
  }, [sessions])

  const directory = connection?.directory || runtime.location.directory

  return (
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`.trim()}>
      <div className="sidebar-head">
        <Brand compact />
        <button type="button" className="icon-btn sidebar-close" onClick={onCloseMobile} aria-label="关闭侧栏">
          <X size={18} />
        </button>
      </div>

      <button
        type="button"
        className="workspace-chip"
        onClick={onOpenSettings}
        title={`${directory} · 点击切换工作区`}
      >
        <span className="workspace-icon">
          <Folder size={14} />
        </span>
        <span className="workspace-copy">
          <small>WORKSPACE</small>
          <strong>{basename(directory)}</strong>
        </span>
        <span className="workspace-edit">
          <Settings2 size={13} />
        </span>
      </button>

      <button type="button" className="new-session-btn" onClick={onNew}>
        <span className="new-session-glow" aria-hidden="true" />
        <Plus size={17} />
        <span>新建会话</span>
        <kbd>N</kbd>
      </button>

      <div className="sidebar-search">
        <Search size={15} />
        <input
          id="session-search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="搜索轨迹、模型、Agent"
          spellCheck={false}
          autoComplete="off"
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="清除搜索">
            <X size={13} />
          </button>
        )}
        <span className="search-key">/</span>
      </div>

      <div className="session-scroll">
        {sessions.length === 0 && (
          <div className="sidebar-empty">
            <span className="eyebrow">NO SIGNAL</span>
            <p>{search ? '没有匹配的会话。' : '这里还没有会话。'}</p>
            {!search && (
              <button type="button" className="text-btn" onClick={onNew}>
                创建会话
              </button>
            )}
          </div>
        )}

        {groups.map(([label, group]) => (
          <div className="session-group" key={label}>
            <div className="session-group-head">
              <span>{label}</span>
              <span className="mono">{String(group.length).padStart(2, '0')}</span>
            </div>
            {group.map((session) => {
              const busy = busySessions.has(session.id)
              const active = session.id === activeSessionID
              const modelName = findModel(runtime.models, session.model)?.name ?? session.model?.id
              return (
                <div className={`session-item ${active ? 'is-active' : ''}`.trim()} key={session.id}>
                  <button
                    type="button"
                    className="session-hit"
                    onClick={() => onSelect(session.id)}
                    aria-current={active ? 'true' : undefined}
                  >
                    <span className={`session-rail ${busy ? 'is-busy' : ''}`.trim()} aria-hidden="true" />
                    <span className="session-copy">
                      <span className="session-title-line">{sessionTitle(session)}</span>
                      <span className="session-meta">
                        <span className="session-agent">{(session.agent ?? 'agent').toUpperCase()}</span>
                        <span className="session-dot">·</span>
                        <span className="session-model">{modelName}</span>
                        <span className="session-dot">·</span>
                        <span>{relativeTime(session.time.updated || session.time.created)}</span>
                      </span>
                    </span>
                    {busy && <Loader2 size={13} className="spin session-spinner" />}
                  </button>
                  <button
                    type="button"
                    className="session-delete"
                    onClick={() => onDelete(session)}
                    title="删除会话"
                    aria-label={`删除 ${sessionTitle(session)}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className={`stream-card stream-${streamState}`}>
          <span className="stream-dot" />
          <div className="stream-copy">
            <strong>{STREAM_LABEL[streamState]}</strong>
            <span>
              v{runtime.server.version} · {Math.round(runtime.latency)}ms
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="连接设置" title="连接设置">
            <Settings2 size={15} />
          </button>
        </div>
        <div className="sidebar-signature">
          <span className="mono">OMMQ · SELF-HOSTED CONSOLE</span>
          <span className="mono">0.1</span>
        </div>
      </div>
    </aside>
  )
}
