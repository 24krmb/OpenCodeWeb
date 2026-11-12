import { useState, type FormEvent } from 'react'
import {
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  Loader2,
  Moon,
  Server,
  ShieldAlert,
  Sun,
  Unplug,
} from 'lucide-react'
import type { ConnectResult, ConnectionConfig, RuntimeInfo, Theme } from '../lib/types'
import { Dialog } from './Dialog'

type SettingsDialogProps = {
  runtime: RuntimeInfo
  connection: ConnectionConfig | null
  theme: Theme
  onClose: () => void
  onConnect: (config: ConnectionConfig) => Promise<ConnectResult>
  onDisconnect: () => void
  onTheme: (theme: Theme) => void
}

export function SettingsDialog({
  runtime,
  connection,
  theme,
  onClose,
  onConnect,
  onDisconnect,
  onTheme,
}: SettingsDialogProps) {
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? '')
  const [password, setPassword] = useState(connection?.password ?? '')
  const [directory, setDirectory] = useState(connection?.directory ?? '')
  const [remember, setRemember] = useState(connection?.remember ?? true)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await onConnect({ baseUrl, password, directory, remember })
      if (result.ok) onClose()
      else setError(result.error ?? '连接失败。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="连接与外观"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            关闭
          </button>
          <button type="submit" form="settings-form" className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            {busy ? '正在重连…' : '保存并重连'}
          </button>
        </>
      }
    >
      <form id="settings-form" className="dialog-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <label className="field">
          <span className="field-label">服务器地址</span>
          <div className="input-shell">
            <Server size={16} />
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} />
          </div>
        </label>

        <label className="field">
          <span className="field-label">访问密码</span>
          <div className="input-shell">
            <KeyRound size={16} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </label>

        <label className="field">
          <span className="field-label">工作区目录</span>
          <div className="input-shell">
            <FolderOpen size={16} />
            <input value={directory} onChange={(event) => setDirectory(event.target.value)} spellCheck={false} />
          </div>
          <span className="field-hint">重新连接后，会话列表会限定到此目录。</span>
        </label>

        <label className="check-row">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span className="check-box" aria-hidden="true" />
          <span>
            记住连接
            <small>{remember ? '密码保存在此浏览器本地。' : '密码仅保存在当前标签页会话中。'}</small>
          </span>
        </label>

        <div className="settings-block">
          <span className="field-label">界面主题</span>
          <div className="theme-switch">
            <button
              type="button"
              className={theme === 'dark' ? 'is-active' : ''}
              onClick={() => onTheme('dark')}
            >
              <Moon size={14} /> 深空
            </button>
            <button
              type="button"
              className={theme === 'light' ? 'is-active' : ''}
              onClick={() => onTheme('light')}
            >
              <Sun size={14} /> 极昼
            </button>
          </div>
        </div>

        <div className="runtime-facts">
          <div>
            <span>服务器</span>
            <strong className="mono">v{runtime.server.version}</strong>
          </div>
          <div>
            <span>延迟</span>
            <strong className="mono">{Math.round(runtime.latency)}ms</strong>
          </div>
          <div>
            <span>项目</span>
            <strong className="mono">{runtime.location.project.id.slice(0, 10)}…</strong>
          </div>
        </div>

        <div className="settings-note">
          <ShieldAlert size={14} />
          <span>
            通过独立域名直连时，配置 <code>--cors</code> 或反向代理，否则浏览器会拦截跨域请求。
          </span>
        </div>

        <div className="danger-zone">
          <div>
            <strong>断开当前服务器</strong>
            <span>清除已保存的连接与密码，并返回连接页面。</span>
          </div>
          <button
            type="button"
            className={`btn ${confirmDisconnect ? 'btn-danger' : 'btn-danger-ghost'} btn-sm`}
            onClick={() => {
              if (!confirmDisconnect) {
                setConfirmDisconnect(true)
                return
              }
              onDisconnect()
              onClose()
            }}
            onBlur={() => setConfirmDisconnect(false)}
          >
            <Unplug size={13} />
            {confirmDisconnect ? '再次点击确认' : '断开连接'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
