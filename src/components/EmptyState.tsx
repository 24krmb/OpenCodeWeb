import { useState } from 'react'
import { ArrowUpRight, Compass, Folder, Plus, Sparkles, TestTube2, Wrench } from 'lucide-react'
import type { RuntimeInfo } from '../lib/types'
import { basename } from '../lib/format'
import { BrandMark } from './Brand'

type EmptyStateProps = {
  runtime: RuntimeInfo
  workspace: string
  quickStarting: boolean
  onNew: () => void
  onQuickStart: (prompt: string) => void
}

const SUGGESTIONS = [
  {
    icon: Compass,
    title: '梳理项目架构',
    detail: '核心模块、依赖关系与入口',
    prompt: '梳理这个项目的整体架构，指出核心模块、关键入口以及它们之间的关系。',
    tone: 'violet',
  },
  {
    icon: TestTube2,
    title: '补上关键测试',
    detail: '找到最值得测试的边界',
    prompt: '分析当前项目，找出最值得补充测试的模块，并直接开始编写高价值测试。',
    tone: 'cyan',
  },
  {
    icon: Wrench,
    title: '排查潜在问题',
    detail: '扫描最近改动与风险点',
    prompt: '检查当前项目最近的改动，找出潜在 bug、风险点和可以改进的地方，并给出修复方案。',
    tone: 'emerald',
  },
]

export function EmptyState({ runtime, workspace, quickStarting, onNew, onQuickStart }: EmptyStateProps) {
  const [pending, setPending] = useState<number | null>(null)

  return (
    <div className="empty-state">
      <div className="empty-orb">
        <span className="empty-ring empty-ring-one" />
        <span className="empty-ring empty-ring-two" />
        <span className="empty-core">
          <BrandMark size={58} glow />
        </span>
      </div>

      <span className="eyebrow">A NEW TRACE</span>
      <h1>
        启动一条新的<span className="text-OMMQ">轨迹</span>
      </h1>
      <p>
        工作区已锁定在 <strong>{basename(workspace)}</strong>。选择一个起点，让 OMMQ 立即开始执行，或创建一条空白会话。
      </p>

      <div className="suggestion-grid">
        {SUGGESTIONS.map((suggestion, index) => {
          const Icon = suggestion.icon
          const busy = quickStarting && pending === index
          return (
            <button
              type="button"
              className={`suggestion suggestion-${suggestion.tone}`}
              key={suggestion.title}
              disabled={quickStarting}
              onClick={() => {
                setPending(index)
                onQuickStart(suggestion.prompt)
              }}
            >
              <span className="suggestion-icon">
                {busy ? <Sparkles size={16} className="spin" /> : <Icon size={16} />}
              </span>
              <span className="suggestion-copy">
                <strong>{suggestion.title}</strong>
                <small>{suggestion.detail}</small>
              </span>
              <ArrowUpRight size={15} className="suggestion-arrow" />
            </button>
          )
        })}
      </div>

      <div className="empty-actions">
        <button type="button" className="btn btn-primary" onClick={onNew}>
          <Plus size={15} />
          新建空白会话
        </button>
        <span className="empty-note">快捷起点会立即创建会话并发送指令。</span>
      </div>

      <div className="empty-meta">
        <span className="meta-chip">
          <Folder size={11} /> {workspace}
        </span>
        <span className="meta-chip mono">OPENCODE v{runtime.server.version}</span>
        <span className="meta-chip mono">{runtime.agents.length} AGENTS</span>
        <span className="meta-chip mono">{runtime.models.length} MODELS</span>
      </div>
    </div>
  )
}
