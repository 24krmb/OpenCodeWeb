import { useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  Loader2,
  Moon,
  Radio,
  Server,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import type { BootState, ConnectResult, ConnectionConfig, Theme } from '../lib/types'
import { Brand } from './Brand'
import { OMMQBackground } from './OMMQBackground'

type ConnectScreenProps = {
  initial: ConnectionConfig | null
  defaultUrl: string
  bootState: BootState
  externalError: string | null
  theme: Theme
  onToggleTheme: () => void
  onConnect: (config: ConnectionConfig) => Promise<ConnectResult>
}

const FEATURES = [
  {
    icon: Radio,
    title: '实时事件流',
    detail: 'SSE 原生流式渲染，推理、工具与文本逐帧抵达。',
    accent: 'violet',
  },
  {
    icon: ShieldCheck,
    title: '权限控制台',
    detail: '工具调用在授权队列中等待你的决定，永不静默越权。',
    accent: 'cyan',
  },
  {
    icon: Activity,
    title: '会话遥测',
    detail: 'Token、成本、模型与执行轨迹，一眼掌握运行状态。',
    accent: 'emerald',
  },
]

export function ConnectScreen({
  initial,
  defaultUrl,
  bootState,
  externalError,
  theme,
  onToggleTheme,
  onConnect,
}: ConnectScreenProps) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl || defaultUrl)
  const [password, setPassword] = useState(initial?.password ?? '')
  const [directory, setDirectory] = useState(initial?.directory ?? '')
  const [remember, setRemember] = useState(initial?.remember ?? true)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(null)
    if (!baseUrl.trim()) {
      setError('请输入 OpenCode 服务器地址。')
      return
    }
    setBusy(true)
    try {
      const result = await onConnect({
        baseUrl,
        password,
        directory,
        remember,
      })
      if (!result.ok) setError(result.error ?? '连接失败。')
    } finally {
      setBusy(false)
    }
  }

  const activeError = error ?? externalError

  return (
    <div className="connect-screen">
      <OMMQBackground />

      <button type="button" className="connect-theme icon-btn" onClick={onToggleTheme} aria-label="切换主题">
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="connect-grid">
        <section className="connect-manifesto">
          <Brand />

          <div className="manifesto-copy">
            <span className="eyebrow">A DISTINCTIVE COCKPIT FOR OPENCODE</span>
            <h1>OpenCode<br/>
              <span className="text-OMMQ">Server Web</span>
            </h1>
            <p>为 OpenCode 打造的自建WEB。展示对话、工具轨迹、权限、审批与会话遥测。</p>
          </div>

          <div className="feature-list">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div className="feature-item" key={feature.title}>
                  <span className={`feature-icon feature-${feature.accent}`}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{feature.title}</strong>
                    <span>{feature.detail}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="manifesto-foot">
            <span className="mono">24KRMB.COM</span>
            <span className="manifesto-rule" />
            <span className="mono">DESIGNED FOR OPENCODE 2.x</span>
          </div>
        </section>

        <section className="connect-card-wrap">
          <form className="connect-card" onSubmit={handleSubmit}>
            <div className="connect-card-head">
              <span className="eyebrow">UPLINK</span>
              <h2>连接你的 OpenCode</h2>
              <p>输入服务器地址与访问密码，进入控制台。</p>
            </div>

            {activeError && (
              <div className="form-error" role="alert">
                {activeError}
              </div>
            )}

            <label className="field">
              <span className="field-label">服务器地址</span>
              <div className="input-shell">
                <Server size={16} />
                <input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="http://127.0.0.1:28894"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  inputMode="url"
                />
              </div>
              <span className="field-hint">
                开发环境默认经 Vite 代理转发到 <code>OPENCODE_SERVER</code>。
              </span>
            </label>

            <label className="field">
              <span className="field-label">访问密码</span>
              <div className="input-shell">
                <KeyRound size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="opencode 服务密码"
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
              <span className="field-hint">
                本机通过内置代理会自动注入密码；远程或直连时填写 service.json 中的密码。
              </span>
            </label>

            <label className="field">
              <span className="field-label">
                工作区目录 <span className="field-optional">可选</span>
              </span>
              <div className="input-shell">
                <FolderOpen size={16} />
                <input
                  value={directory}
                  onChange={(event) => setDirectory(event.target.value)}
                  placeholder="C:\Users\you\projects\app"
                  spellCheck={false}
                />
              </div>
              <span className="field-hint">留空则使用服务器当前工作区。会话将限定在此目录。</span>
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span className="check-box" aria-hidden="true" />
              <span>
                记住连接
                <small>{remember ? '密码保存在此浏览器本地。' : '密码仅保存在当前标签页会话中。'}</small>
              </span>
            </label>

            <button type="submit" className="btn btn-primary connect-submit" disabled={busy}>
              {busy || bootState === 'connecting' ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <Radio size={17} />
              )}
              <span>{busy ? '正在建立链路…' : '建立链路'}</span>
              <ArrowRight size={16} className="connect-arrow" />
            </button>

            <div className="connect-card-foot">
              <span className="mono">opencode serve --port 28894</span>
              <span>本地启动服务后即可连接</span>
            </div>
          </form>

          <div className="connect-security">
            <ShieldCheck size={14} />
            <span>凭据仅用于向你的 OpenCode 服务器发起 Basic Auth 请求，不会离开当前浏览器。</span>
          </div>
        </section>
      </div>
    </div>
  )
}
