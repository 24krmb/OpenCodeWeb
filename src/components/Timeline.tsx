import { useEffect, useMemo, useRef, useState } from 'react'
import type { ModelInfo, SessionInfo, SessionMessageInfo } from '@opencode/client'
import { ArrowDown, Radio } from 'lucide-react'
import { findModel } from '../lib/api'
import { clockTime } from '../lib/format'
import type { StreamState } from '../lib/types'
import { MessageView, ThinkingIndicator } from './Message'
import { BrandMark } from './Brand'

type TimelineProps = {
  messages: SessionMessageInfo[]
  session: SessionInfo | null
  models: ModelInfo[]
  busy: boolean
  loading: boolean
  streamState: StreamState
}

export function Timeline({ messages, session, models, busy, loading, streamState }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const lastAssistant = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.type === 'assistant') return message
    }
    return null
  }, [messages])

  const streamingAssistant = Boolean(lastAssistant && lastAssistant.type === 'assistant' && lastAssistant.time.completed == null)
  const showThinking = busy && !streamingAssistant

  useEffect(() => {
    stickRef.current = true
    setAtBottom(true)
    const container = scrollRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [session?.id])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || !stickRef.current) return
    container.scrollTop = container.scrollHeight
  }, [messages, busy])

  const handleScroll = () => {
    const container = scrollRef.current
    if (!container) return
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    const next = distance < 140
    stickRef.current = next
    setAtBottom(next)
  }

  const scrollToBottom = () => {
    const container = scrollRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    stickRef.current = true
    setAtBottom(true)
  }

  const created = session?.time.created

  return (
    <div className="timeline-wrap">
      <div className="timeline-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="timeline">
          {created && (
            <div className="trace-origin">
              <span className={`trace-signal trace-${streamState}`}>
                <Radio size={11} />
              </span>
              <span className="mono">TRACE INITIATED · {clockTime(created)}</span>
              <span className="trace-line" />
              <span className="mono">{busy ? 'STREAM ACTIVE' : 'STREAM IDLE'}</span>
            </div>
          )}

          {loading && messages.length === 0 && (
            <div className="timeline-skeleton">
              <div className="skeleton-user" />
              <div className="skeleton-assistant">
                <BrandMark size={24} />
                <div>
                  <span className="shimmer-line" />
                  <span className="shimmer-line short" />
                  <span className="shimmer-line" />
                </div>
              </div>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="timeline-empty">
              <span className="timeline-empty-mark">
                <BrandMark size={44} glow />
              </span>
              <strong>还没有消息</strong>
              <p>在下方输入第一条指令，开始新的任务吧。</p>
            </div>
          )}

          {messages.map((message) => {
            const modelName =
              message.type === 'assistant'
                ? findModel(models, message.model)?.name ?? message.model.id
                : undefined
            return <MessageView key={message.id} message={message} modelName={modelName} />
          })}

          {showThinking && <ThinkingIndicator label={streamState === 'live' ? 'OMMQ 正在思考' : '等待服务器响应'} />}

          <div className="timeline-tail" aria-hidden="true" />
        </div>
      </div>

      {!atBottom && (
        <button type="button" className="scroll-bottom" onClick={scrollToBottom} aria-label="跳到最新消息">
          <ArrowDown size={15} />
          <span>最新</span>
        </button>
      )}
    </div>
  )
}
