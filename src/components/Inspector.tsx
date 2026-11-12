import type { SessionInfo, SessionMessageInfo } from '@opencode/client'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BrainCircuit,
  Copy,
  Database,
  Folder,
  Gauge,
  Radio,
  RefreshCw,
  Settings2,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'
import type { ConnectionConfig, RecentEvent, RuntimeInfo, StreamState, ToastKind } from '../lib/types'
import { findModel } from '../lib/api'
import {
  basename,
  clockTime,
  formatCost,
  formatNumber,
  relativeTime,
  sessionTitle,
  shortID,
} from '../lib/format'

type InspectorProps = {
  session: SessionInfo | null
  messages: SessionMessageInfo[]
  runtime: RuntimeInfo
  connection: ConnectionConfig | null
  streamState: StreamState
  lastEventAt: number | null
  recentEvents: RecentEvent[]
  busy: boolean
  onClose: () => void
  onRefresh: () => void
  onDelete: (session: SessionInfo) => void
  onOpenSettings: () => void
  notify: (kind: ToastKind, title: string, detail?: string) => void
}

const STREAM_COPY: Record<StreamState, string> = {
  live: 'LIVE',
  connecting: 'CONNECTING',
  reconnecting: 'RETRYING',
  offline: 'OFFLINE',
}

const EVENT_LABELS: Record<string, string> = {
  'permission.asked': '等待授权',
  'permission.replied': '授权已回复',
  'session.status': '状态变更',
  'session.idle': '会话空闲',
  'session.created': '会话创建',
  'session.deleted': '会话删除',
  'session.renamed': '会话重命名',
  'session.execution.started': '执行开始',
  'session.execution.succeeded': '执行完成',
  'session.execution.failed': '执行失败',
  'session.execution.interrupted': '执行中断',
  'session.step.started': '步骤开始',
  'session.step.ended': '步骤结束',
  'session.step.failed': '步骤失败',
  'session.text.started': '文本开始',
  'session.text.ended': '文本结束',
  'session.reasoning.started': '推理开始',
  'session.reasoning.ended': '推理结束',
  'session.tool.input.started': '工具输入',
  'session.tool.called': '工具调用',
  'session.tool.success': '工具成功',
  'session.tool.failed': '工具失败',
  'session.usage.updated': '用量更新',
  'session.model.selected': '模型切换',
  'session.agent.selected': 'Agent 切换',
  'session.compaction.started': '压缩开始',
  'session.compaction.ended': '压缩结束',
  'session.retry.scheduled': '计划重试',
  'session.inbox.enqueued': '消息入队',
  'session.inbox.delivered': '消息送达',
  'session.synthetic': '合成消息',
}

function eventTone(type: string): string {
  if (type.includes('permission')) return 'amber'
  if (type.includes('failed') || type.includes('interrupted')) return 'rose'
  if (type.includes('tool')) return 'cyan'
  if (type.includes('text') || type.includes('reasoning')) return 'violet'
  if (type.startsWith('session.')) return 'emerald'
  return 'muted'
}

function MiniCopy({ value, label, onCopy }: { value: string; label: string; onCopy: (value: string, label: string) => void }) {
  return (
    <button type="button" className="mini-copy" onClick={() => onCopy(value, label)} aria-label={`复制${label}`} title={`复制${label}`}>
      <Copy size={11} />
    </button>
  )
}

function lastAssistantModel(messages: SessionMessageInfo[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.type === 'assistant') return message.model
  }
  return null
}

export function Inspector({
  session,
  messages,
  runtime,
  connection,
  streamState,
  lastEventAt,
  recentEvents,
  busy,
  onClose,
  onRefresh,
  onDelete,
  onOpenSettings,
  notify,
}: InspectorProps) {
  const tokens = session?.tokens
  const totalTokens = tokens
    ? tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
    : 0
  const modelRef = session?.model ?? lastAssistantModel(messages)
  const modelName = findModel(runtime.models, modelRef)?.name ?? modelRef?.id ?? '—'

  const tokenRows = tokens
    ? [
        { label: '输入', value: tokens.input, tone: 'violet' as const },
        { label: '输出', value: tokens.output, tone: 'cyan' as const },
        { label: '推理', value: tokens.reasoning, tone: 'emerald' as const },
        { label: '缓存读', value: tokens.cache.read, tone: 'amber' as const },
        { label: '缓存写', value: tokens.cache.write, tone: 'rose' as const },
      ]
    : []

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      notify('success', '已复制', label)
    } catch {
      notify('error', '复制失败', '浏览器拒绝了剪贴板访问。')
    }
  }

  return (
    <aside className="inspector">
      <header className="inspector-head">
        <div>
          <span className="eyebrow">INSTRUMENTATION</span>
          <h2>会话遥测</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭遥测面板">
          <X size={17} />
        </button>
      </header>

      <div className="inspector-scroll">
        {!session && (
          <div className="inspector-empty">
            <Gauge size={22} />
            <p>选择一条会话后，这里会显示实时遥测。</p>
          </div>
        )}

        {session && (
          <>
            <section className="inspect-section">
              <div className="inspect-status-row">
                <span className={`inspect-status ${busy ? 'is-busy' : ''}`.trim()}>
                  <span className="status-chip-dot" />
                  {busy ? 'EXECUTING' : 'STANDBY'}
                </span>
                <span className="inspect-updated">{relativeTime(session.time.updated)}</span>
              </div>
              <div className="metric-grid">
                <div className="metric">
                  <span className="metric-label">MODEL</span>
                  <strong title={modelName}>{modelName}</strong>
                </div>
                <div className="metric">
                  <span className="metric-label">AGENT</span>
                  <strong>{(session.agent ?? '—').toUpperCase()}</strong>
                </div>
                <div className="metric">
                  <span className="metric-label">COST</span>
                  <strong className="mono">{formatCost(session.cost)}</strong>
                </div>
                <div className="metric">
                  <span className="metric-label">OUTCOME</span>
                  <strong className={`outcome-text outcome-${session.outcome ?? 'none'}`}>
                    {session.outcome ? session.outcome.toUpperCase() : busy ? 'RUNNING' : 'OPEN'}
                  </strong>
                </div>
              </div>
            </section>

            <section className="inspect-section">
              <div className="inspect-section-head">
                <span className="inspect-label">
                  <Database size={12} /> TOKEN FLOW
                </span>
                <span className="mono inspect-total">{formatNumber(totalTokens)}</span>
              </div>

              <div className="token-summary">
                <div className="token-block token-in">
                  <span className="token-icon">
                    <ArrowDownToLine size={13} />
                  </span>
                  <div>
                    <small>IN</small>
                    <strong className="mono">{formatNumber(tokens?.input ?? 0)}</strong>
                  </div>
                </div>
                <div className="token-block token-out">
                  <span className="token-icon">
                    <ArrowUpFromLine size={13} />
                  </span>
                  <div>
                    <small>OUT</small>
                    <strong className="mono">{formatNumber(tokens?.output ?? 0)}</strong>
                  </div>
                </div>
                <div className="token-block token-reason">
                  <span className="token-icon">
                    <BrainCircuit size={13} />
                  </span>
                  <div>
                    <small>RSN</small>
                    <strong className="mono">{formatNumber(tokens?.reasoning ?? 0)}</strong>
                  </div>
                </div>
              </div>

              <div className="token-bars">
                {tokenRows.map((row) => (
                  <div className="token-row" key={row.label}>
                    <span className="token-row-label">{row.label}</span>
                    <span className="token-track">
                      <span
                        className={`token-fill token-${row.tone}`}
                        style={{ width: `${totalTokens ? Math.max(2, (row.value / totalTokens) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="token-row-value mono">{formatNumber(row.value)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="inspect-section">
              <span className="inspect-label">
                <Folder size={12} /> WORKSPACE
              </span>
              <div className="data-row">
                <span className="data-key">DIR</span>
                <span className="data-value mono" title={connection?.directory || runtime.location.directory}>
                  {basename(connection?.directory || runtime.location.directory)}
                </span>
                <MiniCopy value={connection?.directory || runtime.location.directory} label="工作区路径" onCopy={copy} />
              </div>
              <div className="data-row">
                <span className="data-key">SESSION</span>
                <span className="data-value mono" title={session.id}>
                  {shortID(session.id)}
                </span>
                <MiniCopy value={session.id} label="会话 ID" onCopy={copy} />
              </div>
              <div className="data-row">
                <span className="data-key">PROJECT</span>
                <span className="data-value mono" title={session.projectID}>
                  {shortID(session.projectID)}
                </span>
                <MiniCopy value={session.projectID} label="项目 ID" onCopy={copy} />
              </div>
              <div className="data-row">
                <span className="data-key">TITLE</span>
                <span className="data-value" title={sessionTitle(session)}>
                  {sessionTitle(session)}
                </span>
              </div>
            </section>

            <section className="inspect-section">
              <div className="inspect-section-head">
                <span className="inspect-label">
                  <Activity size={12} /> EVENT PULSE
                </span>
                <span className={`stream-pill stream-${streamState}`}>
                  <span className="stream-dot" />
                  {STREAM_COPY[streamState]}
                </span>
              </div>
              <div className="event-meta">
                <span className="mono">
                  {lastEventAt ? `LAST ${clockTime(lastEventAt)}` : 'WAITING FOR EVENTS'}
                </span>
                <span className="mono">{recentEvents.length} / 30</span>
              </div>
              <div className="event-list">
                {recentEvents.length === 0 && <span className="event-empty">等待事件抵达…</span>}
                {recentEvents.slice(0, 12).map((event) => (
                  <div className="event-row" key={event.id}>
                    <span className={`event-dot event-${eventTone(event.type)}`} />
                    <span className="event-label" title={event.type}>
                      {EVENT_LABELS[event.type] ?? event.type.replace('session.', '')}
                    </span>
                    <span className="event-time mono">{clockTime(event.at)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="inspect-section">
          <span className="inspect-label">
            <Radio size={12} /> RUNTIME
          </span>
          <div className="runtime-grid">
            <div>
              <small>SERVER</small>
              <strong className="mono">v{runtime.server.version}</strong>
            </div>
            <div>
              <small>LATENCY</small>
              <strong className="mono">{Math.round(runtime.latency)}ms</strong>
            </div>
            <div>
              <small>SSE</small>
              <strong className={`mono stream-text-${streamState}`}>{STREAM_COPY[streamState]}</strong>
            </div>
            <div>
              <small>HOST</small>
              <strong className="mono">{runtime.server.hostname ?? 'local'}</strong>
            </div>
          </div>
          <div className="endpoint-row">
            {streamState === 'live' ? <Radio size={12} /> : <WifiOff size={12} />}
            <span className="mono" title={connection?.baseUrl}>
              {connection?.baseUrl}
            </span>
          </div>
          <div className="inspector-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh}>
              <RefreshCw size={13} /> 刷新
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
              <Settings2 size={13} /> 设置
            </button>
          </div>
        </section>

        {session && (
          <section className="inspect-section inspect-danger">
            <button type="button" className="btn btn-danger-ghost" onClick={() => onDelete(session)}>
              <Trash2 size={14} />
              删除这个任务
            </button>
          </section>
        )}
      </div>
    </aside>
  )
}
