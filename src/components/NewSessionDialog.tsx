import { useState, type FormEvent } from 'react'
import type { ModelRef, SessionInfo } from '@opencode/client'
import { Bot, Cpu, Folder, Loader2, Plus, Sparkles } from 'lucide-react'
import type { CreateSessionInput, RuntimeInfo } from '../lib/types'
import { findModel, primaryAgents, providerLabel } from '../lib/api'
import { formatNumber, truncate } from '../lib/format'
import { Dialog } from './Dialog'
import { SelectMenu, type SelectOption } from './SelectMenu'

type NewSessionDialogProps = {
  runtime: RuntimeInfo
  defaults: {
    agent?: string
    model?: ModelRef
    directory?: string
  }
  onClose: () => void
  onCreate: (input: CreateSessionInput) => Promise<SessionInfo | null>
}

export function NewSessionDialog({ runtime, defaults, onClose, onCreate }: NewSessionDialogProps) {
  const agents = primaryAgents(runtime.agents)
  const models = runtime.models.filter((model) => model.enabled)
  const defaultModel =
    findModel(models, defaults.model) ??
    runtime.defaultModel ??
    models[0] ??
    null

  const [title, setTitle] = useState('')
  const [directory, setDirectory] = useState(defaults.directory ?? runtime.location.directory)
  const [agent, setAgent] = useState(defaults.agent ?? agents.find((item) => item.id === 'build')?.id ?? agents[0]?.id ?? '')
  const [modelValue, setModelValue] = useState(
    defaultModel ? `${defaultModel.providerID}::${defaultModel.id}` : '',
  )
  const [variant, setVariant] = useState(defaults.model?.variant ?? '')
  const [busy, setBusy] = useState(false)

  const selectedModel = models.find((model) => `${model.providerID}::${model.id}` === modelValue) ?? null

  const agentOptions: SelectOption[] = agents.map((item) => ({
    value: item.id,
    label: item.name,
    hint: item.description ? truncate(item.description, 60) : item.id,
  }))

  const modelOptions: SelectOption[] = models.map((model) => ({
    value: `${model.providerID}::${model.id}`,
    label: model.name,
    hint: `${providerLabel(model.providerID)} · ${formatNumber(model.limit.context)} ctx${
      model.status !== 'active' ? ` · ${model.status}` : ''
    }`,
    group: providerLabel(model.providerID),
  }))

  const variantOptions: SelectOption[] = [
    { value: '', label: '默认思考' },
    ...(selectedModel?.variants ?? []).map((item) => ({ value: item.id, label: item.id })),
  ]

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const created = await onCreate({
        title: title.trim() || undefined,
        agent: agent || undefined,
        model: selectedModel
          ? {
              id: selectedModel.id,
              providerID: selectedModel.providerID,
              variant: variant || undefined,
            }
          : undefined,
        directory: directory.trim() || undefined,
      })
      if (created) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      eyebrow="NEW TRACE"
      title="新建一条会话"
      description="选择 Agent 与模型，OMMQ 会在指定工作区中开启一条新的轨迹。"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" form="new-session-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
            {busy ? '正在创建…' : '创建会话'}
          </button>
        </>
      }
    >
      <form id="new-session-form" className="dialog-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">
            会话标题 <span className="field-optional">可选</span>
          </span>
          <div className="input-shell">
            <Sparkles size={16} />
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="留空则根据第一条指令自动命名"
              autoFocus
            />
          </div>
        </label>

        <div className="form-grid">
          <div className="field">
            <span className="field-label">Agent</span>
            <SelectMenu
              value={agent}
              options={agentOptions}
              onChange={setAgent}
              placeholder="选择 Agent"
              icon={<Bot size={15} />}
              ariaLabel="选择 Agent"
              emptyLabel="没有可用 Agent"
            />
          </div>
          <div className="field">
            <span className="field-label">模型</span>
            <SelectMenu
              value={modelValue}
              options={modelOptions}
              onChange={(value) => {
                setModelValue(value)
                setVariant('')
              }}
              placeholder="选择模型"
              icon={<Cpu size={15} />}
              searchable
              ariaLabel="选择模型"
              emptyLabel="没有可用模型"
            />
          </div>
        </div>

        {selectedModel && selectedModel.variants.length > 0 && (
          <div className="field">
            <span className="field-label">思考强度</span>
            <SelectMenu
              value={variant}
              options={variantOptions}
              onChange={setVariant}
              placeholder="默认"
              icon={<Sparkles size={15} />}
              ariaLabel="选择思考强度"
            />
          </div>
        )}

        <label className="field">
          <span className="field-label">工作区目录</span>
          <div className="input-shell">
            <Folder size={16} />
            <input
              value={directory}
              onChange={(event) => setDirectory(event.target.value)}
              placeholder="C:\Users\you\projects\app"
              spellCheck={false}
            />
          </div>
          <span className="field-hint">会话、工具执行与文件操作都会以此为根目录。</span>
        </label>

        {models.length === 0 && (
          <div className="form-warning">当前工作区没有可用模型。会话仍可创建，但需要先在 OpenCode 中配置模型。</div>
        )}
      </form>
    </Dialog>
  )
}
