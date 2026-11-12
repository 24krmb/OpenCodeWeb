import { AlertTriangle, Check, Info, X } from 'lucide-react'
import type { ToastMessage } from '../lib/types'

type ToastsProps = {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}

const ICONS = {
  success: Check,
  error: AlertTriangle,
  info: Info,
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind]
        return (
          <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
            <span className="toast-icon">
              <Icon size={15} />
            </span>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.detail && <span>{toast.detail}</span>}
            </div>
            <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="关闭提示">
              <X size={13} />
            </button>
            <span className="toast-life" />
          </div>
        )
      })}
    </div>
  )
}
