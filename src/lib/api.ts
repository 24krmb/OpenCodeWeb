import { ClientError, OpenCode, isUnauthorizedError, type OpenCodeClient } from '@opencode/client'
import type { AgentInfo, ModelInfo, ToolContent } from '@opencode/client'

export function normalizeBaseUrl(input: string): string {
  let value = input.trim()
  if (!value) return ''
  if (value.startsWith('/')) return window.location.origin
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`
  return value.replace(/\/+$/, '')
}

export function createOpenCodeClient(config: { baseUrl: string; password: string }): OpenCodeClient {
  const headers: Record<string, string> = {}
  if (config.password) {
    const raw = `opencode:${config.password}`
    const bytes = new TextEncoder().encode(raw)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    headers.Authorization = `Basic ${btoa(binary)}`
  }

  return OpenCode.make({
    baseUrl: normalizeBaseUrl(config.baseUrl),
    headers,
  })
}

export function describeError(error: unknown): string {
  if (isUnauthorizedError(error)) {
    return '认证失败：服务器密码可能已变更或已失效。请重新输入密码后连接。'
  }
  if (error instanceof ClientError) {
    if (error.reason === 'Transport') {
      return '无法连接服务器。请确认 OpenCode 已启动，并检查地址、CORS 或反向代理配置。'
    }
    return error.message || `请求失败（${error.reason}）`
  }
  if (error instanceof TypeError) {
    return '网络请求失败。可能是服务器未启动、地址错误，或浏览器被 CORS 拦截。'
  }
  if (error instanceof Error) return error.message
  return String(error)
}

export function isUnauthorized(error: unknown): boolean {
  return isUnauthorizedError(error)
}

export function findModel(models: ModelInfo[], ref?: { id: string; providerID: string } | null): ModelInfo | null {
  if (!ref) return null
  return (
    models.find((model) => model.id === ref.id && model.providerID === ref.providerID) ??
    models.find((model) => model.modelID === ref.id && model.providerID === ref.providerID) ??
    null
  )
}

export function primaryAgents(agents: AgentInfo[]): AgentInfo[] {
  return agents.filter((agent) => !agent.hidden && agent.mode !== 'subagent')
}

export function toolOutputText(content?: readonly ToolContent[]): string {
  if (!content?.length) return ''
  return content
    .map((item) => {
      if (item.type === 'text') return item.text
      if (item.type === 'file') return `[file] ${item.name ?? item.uri}`
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

export function hueFromString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % 360
}

export function providerLabel(providerID: string): string {
  if (providerID === 'opencode') return 'OPENCODE'
  return providerID.toUpperCase()
}
