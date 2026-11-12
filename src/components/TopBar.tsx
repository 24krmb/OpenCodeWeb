import type { SessionInfo } from '@opencode/client'
import {
  Menu,
  Moon,
  PanelRight,
  RefreshCw,
  Sun,
  WifiOff,
} from 'lucide-react'
import type { StreamState, Theme } from '../lib/types'
import { sessionTitle, shortID } from '../lib/format'

type TopBarProps = {
  session: SessionInfo | null
  busy: boolean
  streamState: StreamState
  theme: Theme
  inspectorOpen: boolean
  onMenu: () => void
  onRefresh: () => void
  onToggleInspector: () => void
  onToggleTheme: () => void
  refreshing: boolean
}

export function TopBar({
  session,
  busy,
  streamState,
  theme,
  inspectorOpen,
  onMenu,
  onRefresh,
  onToggleInspector,
  onToggleTheme,
  refreshing,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="icon-btn mobile-menu" onClick={onMenu} aria-label="打开侧栏">
          <Menu size={18} />
        </button>

        <div className="topbar-title">
          <div className="topbar-eyebrow">
            <span className="mono">{session ? `TRACE / ${shortID(session.id)}` : 'OMMQ / OVERVIEW'}</span>
            {streamState !== 'live' && (
              <span className={`stream-inline stream-inline-${streamState}`}>
                <WifiOff size={11} />
                {streamState === 'reconnecting' ? '重连中' : streamState === 'connecting' ? '连接中' : '离线'}
              </span>
            )}
          </div>
          <h1>{session ? sessionTitle(session) : '新建会话'}</h1>
        </div>
      </div>

      <div className="topbar-right">
        <span className={`status-chip ${busy ? 'is-busy' : ''}`.trim()}>
          <span className="status-chip-dot" />
          {busy ? '执行中' : '待命'}
        </span>

        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={onRefresh}
            aria-label="刷新数据"
            title="刷新数据"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : undefined} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label="切换主题"
            title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            className={`icon-btn ${inspectorOpen ? 'is-active' : ''}`.trim()}
            onClick={onToggleInspector}
            aria-label="切换遥测面板"
            aria-pressed={inspectorOpen}
            title="切换遥测面板"
          >
            <PanelRight size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
