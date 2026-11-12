import type { ConnectionConfig, Theme } from './types'

const META_KEY = 'OMMQ.connection.meta.v1'
const PASSWORD_KEY = 'OMMQ.connection.password.v1'
const THEME_KEY = 'OMMQ.theme.v1'

// The console was previously branded AURORA. Keep one release of migration so
// existing installs do not lose their saved endpoint, workspace or password.
const LEGACY_META_KEY = 'aurora.connection.meta.v1'
const LEGACY_PASSWORD_KEY = 'aurora.connection.password.v1'
const LEGACY_THEME_KEY = 'aurora.theme.v1'
const SKIP_AUTO_KEY = 'OMMQ.connection.skipAuto.v1'

type ConnectionMeta = {
  baseUrl: string
  directory: string
  remember: boolean
}

function readMeta(): ConnectionMeta | null {
  try {
    const current = window.localStorage.getItem(META_KEY)
    const raw = current ?? window.localStorage.getItem(LEGACY_META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConnectionMeta>
    if (!parsed || typeof parsed.baseUrl !== 'string' || !parsed.baseUrl) return null
    if (!current) window.localStorage.setItem(META_KEY, raw)
    return {
      baseUrl: parsed.baseUrl,
      directory: typeof parsed.directory === 'string' ? parsed.directory : '',
      remember: parsed.remember === true,
    }
  } catch {
    return null
  }
}

export function loadConnection(): ConnectionConfig | null {
  const meta = readMeta()
  if (!meta) return null

  let password = ''
  try {
    password =
      window.localStorage.getItem(PASSWORD_KEY) ??
      window.sessionStorage.getItem(PASSWORD_KEY) ??
      window.localStorage.getItem(LEGACY_PASSWORD_KEY) ??
      window.sessionStorage.getItem(LEGACY_PASSWORD_KEY) ??
      ''

    if (password && !window.localStorage.getItem(PASSWORD_KEY) && !window.sessionStorage.getItem(PASSWORD_KEY)) {
      if (meta.remember) window.localStorage.setItem(PASSWORD_KEY, password)
      else window.sessionStorage.setItem(PASSWORD_KEY, password)
    }
  } catch {
    password = ''
  }

  return {
    baseUrl: meta.baseUrl,
    password,
    directory: meta.directory,
    remember: meta.remember,
  }
}

export function saveConnection(config: ConnectionConfig): void {
  const meta: ConnectionMeta = {
    baseUrl: config.baseUrl,
    directory: config.directory,
    remember: config.remember,
  }

  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta))
    window.localStorage.removeItem(PASSWORD_KEY)
    window.sessionStorage.removeItem(PASSWORD_KEY)
    setSkipAutoConnect(false)

    if (config.password) {
      if (config.remember) {
        window.localStorage.setItem(PASSWORD_KEY, config.password)
      } else {
        window.sessionStorage.setItem(PASSWORD_KEY, config.password)
      }
    }
  } catch {
    // A locked-down browser can reject storage. The session still works.
  }
}

export function clearPassword(): void {
  try {
    window.localStorage.removeItem(PASSWORD_KEY)
    window.sessionStorage.removeItem(PASSWORD_KEY)
    window.localStorage.removeItem(LEGACY_PASSWORD_KEY)
    window.sessionStorage.removeItem(LEGACY_PASSWORD_KEY)
  } catch {
    // noop
  }
}

export function clearConnection(): void {
  try {
    window.localStorage.removeItem(META_KEY)
    window.localStorage.removeItem(PASSWORD_KEY)
    window.sessionStorage.removeItem(PASSWORD_KEY)
    window.localStorage.removeItem(LEGACY_META_KEY)
    window.localStorage.removeItem(LEGACY_PASSWORD_KEY)
    window.sessionStorage.removeItem(LEGACY_PASSWORD_KEY)
  } catch {
    // noop
  }
}

/** True when the user explicitly disconnected in this tab and we should not
 *  silently auto-open the loopback proxy again. */
export function skipAutoConnect(): boolean {
  try {
    return window.sessionStorage.getItem(SKIP_AUTO_KEY) === '1'
  } catch {
    return false
  }
}

export function setSkipAutoConnect(skip: boolean): void {
  try {
    if (skip) window.sessionStorage.setItem(SKIP_AUTO_KEY, '1')
    else window.sessionStorage.removeItem(SKIP_AUTO_KEY)
  } catch {
    // noop
  }
}

export function loadTheme(): Theme {
  try {
    const value =
      window.localStorage.getItem(THEME_KEY) ?? window.localStorage.getItem(LEGACY_THEME_KEY)
    if (value === 'light' || value === 'dark') {
      if (!window.localStorage.getItem(THEME_KEY)) window.localStorage.setItem(THEME_KEY, value)
      return value
    }
  } catch {
    // noop
  }
  return 'dark'
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // noop
  }
}

export function defaultBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_OPENCODE_SERVER as string | undefined
  if (fromEnv) return fromEnv
  if (import.meta.env.DEV) return window.location.origin
  return 'http://127.0.0.1:28894'
}
