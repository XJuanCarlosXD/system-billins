import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, Loader2, Send, User, X } from 'lucide-react'
import {
  type AsistenteMensaje,
  getConversacion,
} from '@/lib/api-client-asistente'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { type ChatMessage, useChatStream } from './use-chat-stream'

type Props = {
  convId: number
  skillActiva?: string | null
  onToolsChange?: (tools: any) => void
}

function mensajeToChatMessage(m: AsistenteMensaje): ChatMessage | null {
  if (m.role === 'user') {
    return {
      id: `srv-${m.id}`,
      role: 'user',
      content: m.content,
      ts: new Date(m.ts_creado).getTime(),
    }
  }
  if (m.role === 'assistant') {
    return {
      id: `srv-${m.id}`,
      role: 'assistant',
      content: m.content,
      ts: new Date(m.ts_creado).getTime(),
      streaming: false,
    }
  }
  return null
}

export function AsistenteChat({ convId, skillActiva, onToolsChange }: Props) {
  const { state, send, cancel, reset } = useChatStream(convId)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Hidratacion inicial: cargar historico desde el backend.
  const { data: convData } = useQuery({
    queryKey: ['asistente', 'conversacion', convId],
    queryFn: () => getConversacion(convId),
    enabled: !!convId,
  })

  useEffect(() => {
    if (!convData) return
    const seed = (convData.mensajes || [])
      .map(mensajeToChatMessage)
      .filter((m): m is ChatMessage => m !== null)
    reset(seed)
  }, [convData, reset])

  useEffect(() => {
    if (onToolsChange) onToolsChange(state.tools)
  }, [state.tools, onToolsChange])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [state.messages, state.streaming])

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const ta = composerRef.current
    if (!ta) return
    const text = ta.value.trim()
    if (!text || state.streaming) return
    ta.value = ''
    ta.style.height = 'auto'
    send(text, { skill: skillActiva })
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`
  }

  return (
    <div className='flex h-full flex-col'>
      <ScrollArea className='flex-1'>
        <div className='mx-auto flex max-w-3xl flex-col gap-4 p-4'>
          {state.messages.length === 0 && !state.streaming && (
            <div className='flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground'>
              <Bot className='size-10 opacity-50' />
              <p>Escribe tu primera pregunta abajo.</p>
              {skillActiva && (
                <p className='text-xs'>
                  Modo activo: <strong>{skillActiva}</strong>
                </p>
              )}
            </div>
          )}

          {state.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {state.error && (
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'>
              {state.error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form
        onSubmit={handleSubmit}
        className='border-t bg-background p-3'
      >
        <div className='mx-auto flex max-w-3xl items-end gap-2 rounded-lg border bg-card p-2 focus-within:ring-1 focus-within:ring-ring'>
          <textarea
            ref={composerRef}
            rows={1}
            onKeyDown={handleKey}
            onChange={autoResize}
            placeholder='Pregunta lo que necesites... (Enter para enviar, Shift+Enter para nueva linea)'
            className='max-h-60 min-h-[28px] flex-1 resize-none bg-transparent text-sm focus:outline-none'
            disabled={state.streaming}
          />
          {state.streaming ? (
            <Button
              type='button'
              size='icon'
              variant='ghost'
              onClick={cancel}
              aria-label='Cancelar generacion'
            >
              <X size={18} />
            </Button>
          ) : (
            <Button type='submit' size='icon' aria-label='Enviar'>
              <Send size={18} />
            </Button>
          )}
        </div>
        {state.streaming && (
          <div className='mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground'>
            <Loader2 size={12} className='animate-spin' />
            <span>Generando respuesta...</span>
          </div>
        )}
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div
        className={cn(
          'flex size-7 flex-none items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
          isUser
            ? 'bg-primary/10 text-foreground'
            : 'bg-card border'
        )}
      >
        {message.content || (
          message.role === 'assistant' && message.streaming ? (
            <span className='text-muted-foreground'>...</span>
          ) : null
        )}
      </div>
    </div>
  )
}
