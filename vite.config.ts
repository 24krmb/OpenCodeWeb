import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const target = process.env.OPENCODE_SERVER ?? 'http://127.0.0.1:28894'
const targetUrl = new URL(target)
const targetBase = `${targetUrl.origin}${targetUrl.pathname.replace(/\/$/, '')}`

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

function isLoopbackAddress(address?: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function parsedHost(host?: string): string | null {
  if (!host) return null
  try {
    return new URL(`http://${host}`).host
  } catch {
    return null
  }
}

function isLoopbackHost(host?: string): boolean {
  const parsed = parsedHost(host)
  if (!parsed) return false
  try {
    return LOOPBACK_HOSTS.has(new URL(`http://${parsed}`).hostname)
  } catch {
    return false
  }
}

function isSameOrigin(origin: string | undefined, host?: string): boolean {
  if (!origin) return true
  try {
    const target = parsedHost(host)
    const parsed = new URL(origin)
    return (
      Boolean(target) &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.host === target
    )
  } catch {
    return false
  }
}

/**
 * Read the local OpenCode service password so the dev/preview proxy can act as
 * a tiny BFF for the person sitting in front of this machine. Only loopback
 * clients get this header, so LAN visitors still need the real password.
 */
function readLocalPassword(): string {
  if (process.env.OPENCODE_PASSWORD) return process.env.OPENCODE_PASSWORD
  try {
    const file = path.join(os.homedir(), '.config', 'opencode', 'service.json')
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { password?: unknown }
    return typeof parsed.password === 'string' ? parsed.password : ''
  } catch {
    return ''
  }
}

function targetIsLocal(): boolean {
  return LOOPBACK_HOSTS.has(targetUrl.hostname)
}

const localPassword =
  targetIsLocal() && process.env.OPENCODE_PROXY_AUTH !== '0' ? readLocalPassword() : ''
const localAuthorization = localPassword
  ? `Basic ${Buffer.from(`opencode:${localPassword}`).toString('base64')}`
  : ''

/**
 * A minimal `/api` reverse proxy for development and preview.
 *
 * Vite's built-in http-proxy opens a fresh socket for every request; the
 * OpenCode server resets some of those connections (ECONNRESET / 502).
 * Native fetch keeps a small keep-alive pool, which is reliable, and its
 * web streams pipe SSE frames straight through to the browser.
 */
function openCodeProxy(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.originalUrl ?? req.url ?? ''
    if (!url.startsWith('/api')) {
      next()
      return
    }

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue
      const lower = key.toLowerCase()
      if (lower === 'host' || lower === 'connection' || lower === 'content-length') continue
      if (lower === 'accept-encoding') continue
      headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
    headers.set('accept-encoding', 'identity')

    let injected = false
    if (
      localAuthorization &&
      !headers.has('authorization') &&
      isLoopbackAddress(req.socket.remoteAddress) &&
      isLoopbackHost(req.headers.host) &&
      req.headers['sec-fetch-site'] !== 'cross-site' &&
      isSameOrigin(req.headers.origin, req.headers.host)
    ) {
      headers.set('authorization', localAuthorization)
      injected = true
    }

    const controller = new AbortController()
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

    const forward = async () => {
      try {
        const upstream = await fetch(`${targetBase}${url}`, {
          method: req.method,
          headers,
          body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
          duplex: hasBody ? 'half' : undefined,
          signal: controller.signal,
          redirect: 'manual',
        } as RequestInit)

        if (upstream.status === 401) {
          const raw = headers.get('authorization') ?? ''
          const [scheme, value = ''] = raw.split(/\s+/)
          let identity = 'none'
          if (scheme?.toLowerCase() === 'basic' && value) {
            try {
              const decoded = Buffer.from(value, 'base64').toString('utf8')
              identity = `basic:${decoded.split(':')[0]}:${decoded.length}`
            } catch {
              identity = 'basic:invalid'
            }
          } else if (scheme) {
            identity = scheme
          }

          // Classify the rejection: if the same credential also fails a plain
          // GET /api/info, the password is wrong. If the probe succeeds, the
          // rejection is specific to this request/method instead.
          let probe = 'skipped'
          if (req.method !== 'GET') {
            try {
              const probeHeaders = new Headers()
              if (raw) probeHeaders.set('authorization', raw)
              const check = await fetch(`${targetBase}/api/info`, { headers: probeHeaders })
              probe = `get:${check.status}`
              await check.body?.cancel()
            } catch {
              probe = 'get:error'
            }
          }

          console.warn(
            `[OMMQ-proxy] upstream 401 ${req.method} ${url} auth=${identity} injected=${injected} probe=${probe} origin=${req.headers.origin ?? '-'} referer=${req.headers.referer ?? '-'}`,
          )
        }

        const responseHeaders: Record<string, string> = {}
        upstream.headers.forEach((value, key) => {
          if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key)) return
          responseHeaders[key] = value
        })

        const isEventStream = (upstream.headers.get('content-type') ?? '').includes('text/event-stream')
        if (isEventStream) {
          responseHeaders['cache-control'] = 'no-cache'
          responseHeaders['x-accel-buffering'] = 'no'
        }

        res.writeHead(upstream.status, responseHeaders)
        res.flushHeaders?.()

        if (!upstream.body) {
          res.end()
          return
        }

        Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream)
          .on('data', (chunk) => res.write(chunk))
          .on('end', () => res.end())
          .on('error', () => res.destroy())
      } catch (error) {
        if (controller.signal.aborted) return
        if (!res.headersSent) {
          res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
          res.end(`OMMQ proxy error: ${error instanceof Error ? error.message : String(error)}`)
        } else {
          res.destroy()
        }
      }
    }

    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    void forward()
  }

  return {
    name: 'OMMQ-opencode-proxy',
    configureServer(server) {
      server.middlewares.use(handler)
      if (localAuthorization) {
        server.config.logger.info('[OMMQ-proxy] loopback auth injection enabled')
      }
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
      if (localAuthorization) {
        server.config.logger.info('[OMMQ-proxy] loopback auth injection enabled')
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), openCodeProxy()],
})
