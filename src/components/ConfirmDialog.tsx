import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { Dialog } from './Dialog'

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open
      onClose={onCancel}
      size="sm"
      eyebrow="CONFIRM"
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
            {busy ? '正在删除…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-body">
        <span className="confirm-glyph">
          <AlertTriangle size={18} />
        </span>
        <p>{description}</p>
      </div>
    </Dialog>
  )
}
