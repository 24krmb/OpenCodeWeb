import { useState } from 'react'
import type {
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageInfo,
  SessionStructuredError,
} from '@opencode/client'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  ChevronDown,
  ClipboardList,
  Copy,
  FilePenLine,
  FilePlus2,
  FileSearch,
  FileText,
  FolderSearch,
  GitBranch,
  Globe,
  Info,
  ListTree,
  Loader2,
  Search,
  Sparkles,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toolOutputText } from '../lib/api'
import {
  basename,
  clockTime,
  formatCost,
  formatDuration,
  formatNumber,
  truncate,
} from '../lib/format'
import { BrandMark } from './Brand'
import { Markdown } from './Markdown'

const TOOL_META: Record<string, { label: string; icon: LucideIcon }> = {
  bash: { label: '终端', icon: Terminal },
  shell: { label: '终端', icon: Terminal },
  read: { label: '读取文件', icon: FileText },
  write: { label: '写入文件', icon: FilePlus2 },
  edit: { label: '编辑文件', icon: FilePenLine },
  multiedit: { label: '批量编辑', icon: FilePenLine },
  patch: { label: '应用补丁', icon: FilePenLine },
  glob: { label: '查找文件', icon: FolderSearch },
  grep: { label: '内容搜索', icon: Search },
  codesearch: { label: '代码搜索', icon: Search },
  list: { label: '列出目录', icon: ListTree },
  task: { label: '子任务', icon: GitBranch },
  webfetch: { label: '网页抓取', icon: Globe },
  todowrite: { label: '更新任务', icon: ClipboardList },
  todoread: { label: '读取任务', icon: ClipboardList },
  readfile: { label: '读取文件', icon: FileSearch },
}

const STATUS_LABEL: Record<string, string> = {
  streaming: '输入中',
  running: '执行中',
  completed: '完成',
  error: '失败',
}

function toolInputSummary(part: SessionMessageAssistantTool): string {
  if (part.state.status === 'streaming') return truncate(part.state.input.replace(/\s+/g, ' '), 68)
  const input = part.state.input as Record<string, unknown>
  const keys = ['command', 'filePath', 'path', 'pattern', 'query', 'url', 'description', 'prompt', 'title']
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return truncate(value.replace(/\s+/g, ' '), 68)
  }
  try {
    return truncate(JSON.stringify(input), 68)
  } catch {
    return ''
  }
}

function ToolCard({ part }: { part: SessionMessageAssistantTool }) {
  const meta = TOOL_META[part.name.toLowerCase()] ?? { label: '工具调用', icon: Wrench }
  const Icon = meta.icon
  const status = part.state.status
  const [open, setOpen] = useState(status === 'error')

  const inputText =
    part.state.status === 'streaming'
      ? part.state.input
      : JSON.stringify(part.state.input, null, 2)

  const output =
    part.state.status === 'completed' || part.state.status === 'error'
      ? toolOutputText(part.state.content)
      : ''

  const duration =
    part.time.completed != null
      ? part.time.completed - (part.time.ran ?? part.time.created)
      : part.time.ran != null
        ? Date.now() - part.time.ran
        : null

  return (
    <div className={`tool-card tool-${status}`}>
      <button type="button" className="tool-head" onClick={() => setOpen((current) => !current)}>
        <span className="tool-glyph">
          <Icon size={14} />
        </span>
        <span className="tool-heading">
          <span className="tool-label">{meta.label}</span>
          <span className="tool-name mono">{part.name}</span>
        </span>
        <span className="tool-summary mono">{toolInputSummary(part)}</span>
        <span className={`tool-status tool-status-${status}`}>
          {(status === 'streaming' || status === 'running') && <Loader2 size={11} className="spin" />}
          {STATUS_LABEL[status]}
        </span>
        {duration != null && duration > 0 && <span className="tool-duration mono">{formatDuration(duration)}</span>}
        <ChevronDown size={14} className={`tool-chevron ${open ? 'is-open' : ''}`.trim()} />
      </button>

      {open && (
        <div className="tool-body">
          {part.state.status === 'error' && (
            <div className="tool-error">
              <AlertTriangle size={14} />
              <div>
                <strong>{part.state.error.type}</strong>
                <span>{part.state.error.message}</span>
              </div>
            </div>
          )}
          {inputText && (
            <div className="tool-section">
              <span className="tool-section-label">INPUT</span>
              <pre className="tool-pre">{inputText}</pre>
            </div>
          )}
          {part.state.status === 'completed' && (
            <div className="tool-section">
              <span className="tool-section-label">OUTPUT</span>
              {output ? <pre className="tool-pre">{output}</pre> : <p className="tool-empty">无输出</p>}
            </div>
          )}
          {part.state.status === 'error' && output && (
            <div className="tool-section">
              <span className="tool-section-label">DETAIL</span>
              <pre className="tool-pre">{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReasoningBlock({ part }: { part: Extract<SessionMessageAssistant['content'][number], { type: 'reasoning' }> }) {
  const [open, setOpen] = useState(false)
  const active = !part.time?.completed
  const duration = part.time ? (part.time.completed ?? Date.now()) - part.time.created : null

  return (
    <div className={`reasoning ${active ? 'is-active' : ''}`.trim()}>
      <button type="button" className="reasoning-head" onClick={() => setOpen((current) => !current)}>
        <span className="reasoning-glyph">
          <BrainCircuit size={14} />
        </span>
        <span className="reasoning-title">推理轨迹</span>
        <span className="reasoning-state mono">{active ? 'LIVE' : duration != null ? formatDuration(duration) : 'trace'}</span>
        {active && <span className="reasoning-pulse" aria-hidden="true" />}
        <ChevronDown size={14} className={`reasoning-chevron ${open ? 'is-open' : ''}`.trim()} />
      </button>
      {open && (
        <div className="reasoning-body">
          {part.text ? <div className="reasoning-text">{part.text}</div> : <span className="shimmer-line" />}
        </div>
      )}
    </div>
  )
}

function ErrorPanel({ error }: { error: SessionStructuredError }) {
  return (
    <div className="msg-error">
      <AlertTriangle size={16} />
      <div>
        <strong>{error.type}</strong>
        <span>{error.message}</span>
        {error.status && <small className="mono">HTTP {error.status}</small>}
      </div>
    </div>
  )
}

export function ThinkingIndicator({ label = 'OMMQ 正在思考' }: { label?: string }) {
  return (
    <div className="thinking">
      <span className="thinking-mark">
        <BrandMark size={22} glow />
      </span>
      <div className="thinking-copy">
        <span>{label}</span>
        <span className="thinking-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  )
}

function AssistantMessage({ message, modelName }: { message: SessionMessageAssistant; modelName?: string }) {
  const hasContent = message.content.some((part) => (part.type === 'text' ? part.text.trim() : true))
  const duration =
    message.time.completed != null ? message.time.completed - message.time.created : null

  return (
    <article className="msg msg-assistant">
      <header className="msg-head">
        <span className="msg-avatar">
          <BrandMark size={24} />
        </span>
        <div className="msg-meta">
          <span className="msg-author">{(message.agent ?? 'agent').toUpperCase()}</span>
          <span className="msg-model mono">{modelName ?? message.model.id}</span>
          <span className="msg-time mono">{clockTime(message.time.created)}</span>
        </div>
        {message.time.completed == null && <span className="msg-live">LIVE</span>}
      </header>

      <div className="msg-content">
        {message.content.map((part, index) => {
          if (part.type === 'text') {
            return part.text.trim() ? <Markdown key={`text-${index}`}>{part.text}</Markdown> : null
          }
          if (part.type === 'reasoning') {
            return <ReasoningBlock key={`reasoning-${index}`} part={part} />
          }
          return <ToolCard key={`tool-${part.id}`} part={part} />
        })}

        {!hasContent && !message.error && message.time.completed == null && <ThinkingIndicator />}
        {!hasContent && !message.error && message.time.completed != null && (
          <p className="msg-empty">这一轮没有产生输出。</p>
        )}
        {message.error && <ErrorPanel error={message.error} />}
      </div>

      {(message.tokens || message.time.completed != null || message.retry) && (
        <footer className="msg-foot">
          {message.retry && (
            <span className="msg-retry">
              <Zap size={11} /> 重试 {message.retry.attempt}
            </span>
          )}
          {message.tokens && (
            <>
              <span className="mono">
                <ArrowDown size={10} /> {formatNumber(message.tokens.input)}
              </span>
              <span className="mono">
                <ArrowUp size={10} /> {formatNumber(message.tokens.output)}
              </span>
              <span className="mono">RSN {formatNumber(message.tokens.reasoning)}</span>
              <span className="mono">CACHE {formatNumber(message.tokens.cache.read)}</span>
            </>
          )}
          {message.cost != null && <span className="mono">{formatCost(message.cost)}</span>}
          {duration != null && <span className="mono">{formatDuration(duration)}</span>}
          {message.finish === 'error' && <span className="msg-finish is-error">ERROR</span>}
        </footer>
      )}
    </article>
  )
}

function UserMessage({ message }: { message: Extract<SessionMessageInfo, { type: 'user' }> }) {
  return (
    <article className="msg msg-user">
      <header className="msg-head">
        <div className="msg-meta">
          <span className="msg-time mono">{clockTime(message.time.created)}</span>
          <span className="msg-author">YOU</span>
        </div>
        <span className="msg-avatar msg-avatar-user">Y</span>
      </header>
      <div className="user-bubble">
        <div className="user-text">{message.text}</div>
        {message.files && message.files.length > 0 && (
          <div className="user-files">
            {message.files.map((file, index) => (
              <span className="file-chip mono" key={`${file.name ?? file.mime}-${index}`}>
                <FileText size={11} />
                {file.name ?? basename(file.mime)}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function SystemRow({ message }: { message: SessionMessageInfo }) {
  if (message.type === 'agent-switched') {
    return (
      <div className="system-row">
        <GitBranch size={12} />
        <span>
          Agent 切换为 <b>{message.agent}</b>
        </span>
        <span className="system-time mono">{clockTime(message.time.created)}</span>
      </div>
    )
  }
  if (message.type === 'model-switched') {
    return (
      <div className="system-row">
        <Zap size={12} />
        <span>
          模型切换为 <b>{message.model.id}</b>
        </span>
        <span className="system-time mono">{clockTime(message.time.created)}</span>
      </div>
    )
  }
  if (message.type === 'location-switched') {
    return (
      <div className="system-row">
        <FolderSearch size={12} />
        <span>
          工作区切换为 <b>{basename(message.location?.directory ?? '')}</b>
        </span>
        <span className="system-time mono">{clockTime(message.time.created)}</span>
      </div>
    )
  }

  const text =
    message.type === 'system' || message.type === 'synthetic'
      ? message.text
      : message.type === 'skill'
        ? message.text
        : ''

  if (!text) return null

  return (
    <details className="system-details">
      <summary>
        <Info size={12} />
        <span>
          {message.type === 'skill' ? `技能 · ${message.name}` : message.type === 'synthetic' ? '合成上下文' : '系统消息'}
        </span>
        <span className="system-time mono">{clockTime(message.time.created)}</span>
      </summary>
      <div className="system-details-body">{text}</div>
    </details>
  )
}

function CompactionMessage({ message }: { message: Extract<SessionMessageInfo, { type: 'compaction' }> }) {
  const summary = 'summary' in message ? message.summary : ''
  return (
    <details className="compaction-card">
      <summary>
        <ClipboardList size={13} />
        <span>上下文压缩</span>
        <span className={`compaction-status compaction-${message.status}`}>{message.status}</span>
        <span className="system-time mono">{clockTime(message.time.created)}</span>
      </summary>
      {summary ? <div className="compaction-body">{summary}</div> : <div className="compaction-body">压缩进行中…</div>}
    </details>
  )
}

function ShellMessage({ message }: { message: Extract<SessionMessageInfo, { type: 'shell' }> }) {
  return (
    <div className="shell-card">
      <div className="shell-head">
        <Terminal size={13} />
        <code>{message.command}</code>
        <span className={`shell-status shell-${message.status}`}>{message.status}</span>
      </div>
      {message.output?.output && <pre className="shell-output">{message.output.output}</pre>}
    </div>
  )
}

export function MessageView({ message, modelName }: { message: SessionMessageInfo; modelName?: string }) {
  switch (message.type) {
    case 'user':
      return <UserMessage message={message} />
    case 'assistant':
      return <AssistantMessage message={message} modelName={modelName} />
    case 'compaction':
      return <CompactionMessage message={message} />
    case 'shell':
      return <ShellMessage message={message} />
    case 'idle':
      if (message.outcome === 'succeeded') return null
      return (
        <div className={`outcome-row outcome-${message.outcome}`}>
          {message.outcome === 'failed' ? <AlertTriangle size={13} /> : <Info size={13} />}
          <span>{message.outcome === 'failed' ? '本轮执行失败' : '本轮执行已中断'}</span>
          {message.error && <span className="mono">{message.error.type}</span>}
        </div>
      )
    case 'skill':
    case 'system':
    case 'synthetic':
    case 'agent-switched':
    case 'model-switched':
    case 'location-switched':
      return <SystemRow message={message} />
    default:
      return null
  }
}

export function CopyButton({ value, label = '复制' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="copy-inline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          // noop
        }
      }}
      title={label}
      aria-label={label}
    >
      {copied ? <Sparkles size={12} /> : <Copy size={12} />}
      <span>{copied ? '已复制' : label}</span>
    </button>
  )
}
