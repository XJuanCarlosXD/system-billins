// Hook que gestiona el stream SSE del chat. Como el endpoint es POST con body,
// no podemos usar EventSource (que es GET-only); usamos fetch + ReadableStream.

import { useCallback, useReducer, useRef } from 'react'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

export type ToolEntry = {
  sig?: string
  call_id: string
  tool_name: string
  status: 'running' | 'ok' | 'error' | 'pending'
  args?: any
  result?: any
  preview?: string
  duration_ms?: number
  ts: number
}

export type ChatMessage =
  | { id: string; role: 'user'; content: string; ts: number }
  | { id: string; role: 'assistant'; content: string; ts: number; streaming?: boolean }

export type ChatTotals = {
  tokens_in: number
  tokens_out: number
  cost_usd: number
  turns: number
}

type State = {
  messages: ChatMessage[]
  tools: Record<string, ToolEntry>
  streaming: boolean
  error: string | null
  totals: ChatTotals
}

type Action =
  | { type: 'reset'; messages?: ChatMessage[] }
  | { type: 'add_user'; content: string }
  | { type: 'turn_started' }
  | { type: 'token'; text: string }
  | { type: 'tool_call'; data: any }
  | { type: 'tool_pending'; data: any }
  | { type: 'tool_result'; data: any }
  | { type: 'tool_error'; data: any }
  | { type: 'message_complete'; data: any }
  | { type: 'done' }
  | { type: 'error'; message: string }

const initialState: State = {
  messages: [],
  tools: {},
  streaming: false,
  error: null,
  totals: { tokens_in: 0, tokens_out: 0, cost_usd: 0, turns: 0 },
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return { ...initialState, messages: action.messages ?? [] }
    case 'add_user':
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: newId(), role: 'user', content: action.content, ts: Date.now() },
        ],
        streaming: true,
        error: null,
      }
    case 'turn_started': {
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'assistant' && last.streaming) return state
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: newId(),
            role: 'assistant',
            content: '',
            ts: Date.now(),
            streaming: true,
          },
        ],
      }
    }
    case 'token': {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last?.role === 'assistant' && last.streaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + action.text }
      }
      return { ...state, messages: msgs }
    }
    case 'tool_call': {
      const d = action.data
      return {
        ...state,
        tools: {
          ...state.tools,
          [d.call_id]: {
            call_id: d.call_id,
            tool_name: d.tool_name,
            status: 'running',
            args: d.args,
            ts: Date.now(),
          },
        },
      }
    }
    case 'tool_pending': {
      const d = action.data
      return {
        ...state,
        tools: {
          ...state.tools,
          [d.call_id]: {
            call_id: d.call_id,
            tool_name: d.tool_name,
            status: 'pending',
            sig: d.sig,
            args: d.args,
            preview: d.preview,
            ts: Date.now(),
          },
        },
      }
    }
    case 'tool_result': {
      const d = action.data
      const existing = state.tools[d.call_id] || {
        call_id: d.call_id,
        tool_name: d.tool_name,
        status: 'ok' as const,
        ts: Date.now(),
      }
      return {
        ...state,
        tools: {
          ...state.tools,
          [d.call_id]: {
            ...existing,
            status: 'ok',
            result: d.result,
            duration_ms: d.duration_ms,
          },
        },
      }
    }
    case 'tool_error': {
      const d = action.data
      const existing = state.tools[d.call_id] || {
        call_id: d.call_id,
        tool_name: d.tool_name,
        status: 'error' as const,
        ts: Date.now(),
      }
      return {
        ...state,
        tools: {
          ...state.tools,
          [d.call_id]: {
            ...existing,
            status: 'error',
            result: d.error ?? d,
          },
        },
      }
    }
    case 'message_complete': {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last?.role === 'assistant' && last.streaming) {
        msgs[msgs.length - 1] = { ...last, streaming: false }
      }
      const d = action.data || {}
      // El backend emite totales acumulados por turno (no incrementos).
      const totals: ChatTotals = {
        tokens_in: Number(d.tokens_in) || state.totals.tokens_in,
        tokens_out: Number(d.tokens_out) || state.totals.tokens_out,
        cost_usd: Number(d.cost_usd) || state.totals.cost_usd,
        turns: state.totals.turns + 1,
      }
      return { ...state, messages: msgs, totals }
    }
    case 'done':
      return { ...state, streaming: false }
    case 'error':
      return { ...state, streaming: false, error: action.message }
    default:
      return state
  }
}

export function useChatStream(convId: number | null) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback((seed?: ChatMessage[]) => {
    dispatch({ type: 'reset', messages: seed })
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    dispatch({ type: 'done' })
  }, [])

  const send = useCallback(
    async (message: string, opts?: { skill?: string | null }) => {
      if (!convId) return
      dispatch({ type: 'add_user', content: message })

      const ac = new AbortController()
      abortRef.current = ac

      try {
        const res = await fetch(
          `${API_BASE}/asistente/conversaciones/${convId}/chat/`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, skill: opts?.skill ?? null }),
            signal: ac.signal,
          }
        )

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '')
          dispatch({
            type: 'error',
            message: `HTTP ${res.status}: ${text || 'sin detalle'}`,
          })
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE: eventos delimitados por linea en blanco \n\n
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const raw = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)

            let event = 'message'
            let data: any = {}
            for (const line of raw.split('\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim()
              else if (line.startsWith('data:')) {
                try {
                  data = JSON.parse(line.slice(5).trim())
                } catch {
                  data = {}
                }
              }
            }

            switch (event) {
              case 'turn_started':
                dispatch({ type: 'turn_started' })
                break
              case 'token':
                dispatch({ type: 'token', text: data.text || '' })
                break
              case 'tool_call':
                dispatch({ type: 'tool_call', data })
                break
              case 'tool_pending':
                dispatch({ type: 'tool_pending', data })
                break
              case 'tool_result':
                dispatch({ type: 'tool_result', data })
                break
              case 'tool_error':
                dispatch({ type: 'tool_error', data })
                break
              case 'message_complete':
                dispatch({ type: 'message_complete', data })
                break
            }
          }
        }

        dispatch({ type: 'done' })
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          dispatch({ type: 'done' })
        } else {
          dispatch({ type: 'error', message: e?.message || String(e) })
        }
      } finally {
        abortRef.current = null
      }
    },
    [convId]
  )

  return { state, send, cancel, reset }
}
