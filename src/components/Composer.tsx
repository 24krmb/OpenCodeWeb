import { useEffect, useRef, useState } from 'react'
import type { AgentInfo, ModelInfo, SessionInfo } from '@opencode/client'
import {
  ArrowUp,
  Bot,
  CornerDownLeft,
  Cpu,
  Square,
  Sparkles,
} from 'lucide-react'
import type { SelectOption } from './SelectMenu'
import { SelectMenu } from './SelectMenu'
import { findModel, primaryAgents, providerLabel } from '../lib/api'
import { formatNumber, truncate } from '../lib/format'

type ComposerProps = {
  session: SessionInfo
  agents: AgentInfo[]
  models: ModelInfo[]
  busy: boolean
  focusToken: number
  onSend: (text: string) => Promise<boolean>
  onStop: () => void
  onSwitchAgent: (agent: string) => void
  onSwitchModel: (model: { id: string; providerID: string; variant?: string }) => void
}

export function Composer({
  session,
  agents,
  models,
  busy,
  focusToken,
  onSend,
  onStop,
  onSwitchAgent,
  onSwitchModel,
}: ComposerProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const availableAgents = primaryAgents(agents)
  const currentModel = findModel(models, session.model)
  const enabledModels = models.filter((model) => model.enabled)

  const agentOptions: SelectOption[] = availableAgents.map((agent) => ({
    value: agent.id,
    label: agent.name,
    hint: agent.description ? truncate(agent.description, 52) : agent.id,
  }))

  const modelOptions: SelectOption[] = enabledModels.map((model) => ({
    value: `${model.providerID}::${model.id}`,
    label: model.name,
    hint: `${providerLabel(model.providerID)} · ${formatNumber(model.limit.context)} ctx${
      model.status !== 'active' ? ` · ${model.status}` : ''
    }`,
    group: providerLabel(model.providerID),
  }))

  const selectedModelValue = session.model ? `${session.model.providerID}::${session.model.id}` : ''
  const variants = currentModel?.variants ?? []
  const variantValue = session.model?.variant ?? ''

  const variantOptions: SelectOption[] = [
    { value: '', label: '默认思考' },
    ...variants.map((variant) => ({ value: variant.id, label: variant.id })),
  ]

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 208)}px`
  }, [text])

  useEffect(() => {
    if (focusToken === 0) return
    textareaRef.current?.focus()
  }, [focusToken])

  const submit = async () => {
    const value = text.trim()
    if (!value || busy) return
    setText('')
    const ok = await onSend(value)
    if (!ok) setText(value)
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <div className={`composer ${busy ? 'is-busy' : ''}`.trim()}>
      <div className="composer-glow" aria-hidden="true" />
      <div className="composer-inner">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void submit()
            }
          }}
          rows={1}
          placeholder={busy ? 'OMMQ 正在执行，可以先起草下一条指令…' : '向 OMMQ 发送指令…'}
          spellCheck={false}
          aria-label="消息输入框"
        />

        <div className="composer-bar">
          <div className="composer-selects">
            <SelectMenu
              value={session.agent ?? availableAgents[0]?.id ?? ''}
              options={agentOptions}
              onChange={onSwitchAgent}
              placeholder="选择 Agent"
              icon={<Bot size={14} />}
              align="up"
              ariaLabel="选择 Agent"
              emptyLabel="没有可用 Agent"
            />
            <SelectMenu
              value={selectedModelValue}
              options={modelOptions}
              onChange={(value) => {
                const [providerID, id] = value.split('::')
                if (providerID && id) onSwitchModel({ providerID, id })
              }}
              placeholder={session.model?.id ?? '选择模型'}
              icon={<Cpu size={14} />}
              align="up"
              searchable
              ariaLabel="选择模型"
              emptyLabel="没有可用模型"
            />
            {variants.length > 0 && (
              <SelectMenu
                value={variantValue}
                options={variantOptions}
                onChange={(value) => {
                  if (!currentModel) return
                  onSwitchModel({
                    id: currentModel.id,
                    providerID: currentModel.providerID,
                    variant: value || undefined,
                  })
                }}
                placeholder="默认"
                icon={<Sparkles size={14} />}
                align="up"
                className="variant-select"
                ariaLabel="选择推理强度"
              />
            )}
          </div>

          <div className="composer-actions">
            <span className="composer-hint">
              <CornerDownLeft size={12} />
              <span>Enter 发送 · Shift + Enter 换行</span>
            </span>
            {busy ? (
              <button type="button" className="send-btn stop-btn" onClick={onStop} aria-label="停止执行" title="停止执行">
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="send-btn"
                onClick={() => void submit()}
                disabled={!text.trim()}
                aria-label="发送消息"
                title="发送消息"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="composer-foot">
        <span className="mono">
          {busy ? 'EXECUTION IN PROGRESS' : 'OMMQ READY'} · {providerLabel(session.model?.providerID ?? 'local')}
        </span>
        <span className="mono">{text.length > 0 ? `${text.length} CHARS` : 'STREAM · SSE'}</span>
      </div>
    </div>
  )
}
