import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PermissionRequest, SessionInfo } from '@opencode/client'
import { Check, Loader2, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { sessionTitle, truncate } from '../lib/format'

type PermissionDockProps = {
  permissions: PermissionRequest[]
  sessions: SessionInfo[]
  onReply: (request: PermissionRequest, decision: 'once' | 'always' | 'reject') => Promise<void>
}

const ACTION_LABELS: Record<string, string> = {
  bash: '执行终端命令',
  edit: '修改文件',
  write: '写入文件',
  read: '读取文件',
  webfetch: '访问网络',
  task: '运行子任务',
  todowrite: '写入任务清单',
  patch: '应用补丁',
  external_directory: '访问工作区外目录',
}

export function PermissionDock({ permissions, sessions, onReply }: PermissionDockProps) {
  const [pending, setPending] = useState<{ id: string; decision: 'once' | 'always' | 'reject' } | null>(null)

  if (permissions.length === 0) return null

  const handleReply = async (request: PermissionRequest, decision: 'once' | 'always' | 'reject') => {
    setPending({ id: request.id, decision })
    try {
      await onReply(request, decision)
    } finally {
      setPending(null)
    }
  }

  return createPortal(
    <div className="permission-layer" aria-live="assertive">
      <div className="permission-layer-head">
        <ShieldAlert size={14} />
        <span className="mono">AUTHORIZATION QUEUE</span>
        <span className="permission-count">{permissions.length}</span>
      </div>

      <div className="permission-stack">
        {permissions.map((request) => {
          const session = sessions.find((item) => item.id === request.sessionID)
          const action = ACTION_LABELS[request.action] ?? request.action
          const busy = pending?.id === request.id
          return (
            <article className="permission-card" key={request.id}>
              <div className="permission-top">
                <span className="permission-glyph">
                  <ShieldCheck size={16} />
                </span>
                <div className="permission-title">
                  <span className="eyebrow">PERMISSION REQUEST</span>
                  <strong>{action}</strong>
                </div>
                <span className="permission-action mono">{request.action}</span>
              </div>

              {request.message && <p className="permission-message">{request.message}</p>}

              <div className="permission-resources">
                {request.resources.slice(0, 3).map((resource, index) => (
                  <span className="resource-chip mono" key={`${resource}-${index}`} title={resource}>
                    {truncate(resource, 58)}
                  </span>
                ))}
                {request.resources.length > 3 && (
                  <span className="resource-more mono">+{request.resources.length - 3}</span>
                )}
              </div>

              <div className="permission-foot">
                <span className="permission-session" title={session?.id}>
                  {session ? sessionTitle(session) : request.sessionID}
                </span>
                <div className="permission-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm permission-reject"
                    disabled={Boolean(pending)}
                    onClick={() => void handleReply(request, 'reject')}
                  >
                    {busy && pending?.decision === 'reject' ? <Loader2 size={12} className="spin" /> : <X size={12} />}
                    拒绝
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={Boolean(pending)}
                    onClick={() => void handleReply(request, 'always')}
                  >
                    {busy && pending?.decision === 'always' ? <Loader2 size={12} className="spin" /> : null}
                    始终允许
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={Boolean(pending)}
                    onClick={() => void handleReply(request, 'once')}
                  >
                    {busy && pending?.decision === 'once' ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                    允许一次
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
