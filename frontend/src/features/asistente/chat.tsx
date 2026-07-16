import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUp,
  Bot,
  FileText,
  Globe,
  Loader2,
  Paperclip,
  Sparkles,
  Square,
  Wrench,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  ASISTENTE_MODEL_LABEL,
  type AsistenteMensaje,
  getConversacion,
  patchConversacion,
} from '@/lib/api-client-asistente'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SkillPicker } from './skill-picker'
import { ToolConfirmModal } from './tool-confirm-modal'
import {
  type ChatAttachment,
  type ChatMessage,
  useChatStream,
} from './use-chat-stream'
import { useAsistenteShortcuts } from './use-shortcuts'

type Props = {
  convId: string
  onConvSwitch?: (id: string) => void
  onToolsChange?: (tools: any) => void
  onTotalsChange?: (totals: any) => void
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]
const MAX_FILES = 4
const MAX_FILE_MB = 10

const SUGGESTIONS = [
  { icon: FileText, text: 'Muestra las facturas pendientes de hoy' },
  { icon: Globe, text: 'Busca en internet el precio actual del dólar en RD' },
  { icon: Paperclip, text: 'Adjunta una factura en PDF y te la analizo' },
]

// Maps a persisted backend message (Oracle TCHAT_MENSAJE row) to the
// reducer's ChatMessage shape. Tool-call rows are dropped from the visible
// history (the streaming view tracks tool activity separately).
function mensajeToChatMessage(m: AsistenteMensaje): ChatMessage | null {
  const ts = m.fecha ? new Date(m.fecha).getTime() : Date.now()
  if (m.role === 'user') {
    return { id: `srv-${m.mensaje_id}`, role: 'user', content: m.contenido, ts }
  }
  if (m.role === 'assistant') {
    return {
      id: `srv-${m.mensaje_id}`,
      role: 'assistant',
      content: m.contenido,
      ts,
      streaming: false,
    }
  }
  return null
}

async function fileToAttachment(file: File): Promise<ChatAttachment> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read_error'))
    r.readAsDataURL(file)
  })
  return {
    name: file.name,
    media_type: file.type,
    data: dataUrl.split(',')[1] || '',
    dataUrl: file.type.startsWith('image/') ? dataUrl : undefined,
  }
}

export function AsistenteChat({
  convId,
  onConvSwitch,
  onToolsChange,
  onTotalsChange,
}: Props) {
  const { state, send, cancel, reset } = useChatStream(convId)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const [skillActiva, setSkillActiva] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [dismissedSig, setDismissedSig] = useState<string | null>(null)

  const lastUserMessage = useMemo(() => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const m = state.messages[i]
      if (m.role === 'user') return m.content
    }
    return null
  }, [state.messages])

  // Hidratacion inicial: cargar historico desde el backend.
  const { data: convData } = useQuery({
    queryKey: ['asistente', 'conversacion', convId],
    queryFn: () => getConversacion(convId),
    enabled: !!convId,
  })

  useEffect(() => {
    if (!convData) return
    const seed = (convData.messages || [])
      .map(mensajeToChatMessage)
      .filter((m): m is ChatMessage => m !== null)
    reset(seed)
    const sv = convData.conversacion?.skill_activa
    if (sv !== undefined) setSkillActiva(sv || null)
  }, [convData, reset])

  // Limite de contexto alcanzado: el backend resumio y creo otra seccion.
  useEffect(() => {
    if (!state.compactedTo) return
    toast.info(
      'Se alcanzó el límite de contexto. Continuamos en una nueva sección con un resumen.',
      { duration: 8000 }
    )
    qc.invalidateQueries({ queryKey: ['asistente', 'conversaciones'] })
    onConvSwitch?.(state.compactedTo.convId)
  }, [state.compactedTo, onConvSwitch, qc])

  function handleSkillChange(s: string | null) {
    setSkillActiva(s)
    patchConversacion(convId, { skill_activa: s }).catch(() => {})
  }

  useEffect(() => {
    if (onToolsChange) onToolsChange(state.tools)
  }, [state.tools, onToolsChange])

  useEffect(() => {
    if (onTotalsChange) onTotalsChange(state.totals)
  }, [state.totals, onTotalsChange])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [state.messages, state.streaming])

  useAsistenteShortcuts({
    onCancelStream: () => {
      if (state.streaming) cancel()
    },
  })

  const pendingTool = useMemo(
    () =>
      Object.values(state.tools).find((t) => t.status === 'pending') ?? null,
    [state.tools]
  )
  const runningTools = useMemo(
    () => Object.values(state.tools).filter((t) => t.status === 'running'),
    [state.tools]
  )

  const contextPct = state.totals.context_limit
    ? Math.min(
        100,
        Math.round(
          (state.totals.context_tokens / state.totals.context_limit) * 100
        )
      )
    : 0

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files)
    for (const f of list) {
      if (attachments.length + 1 > MAX_FILES) {
        toast.error(`Máximo ${MAX_FILES} archivos por mensaje.`)
        return
      }
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast.error(`Tipo no soportado: ${f.name}. Solo PDF o imágenes.`)
        continue
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} supera ${MAX_FILE_MB}MB.`)
        continue
      }
      try {
        const att = await fileToAttachment(f)
        setAttachments((prev) =>
          prev.length >= MAX_FILES ? prev : [...prev, att]
        )
      } catch {
        toast.error(`No se pudo leer ${f.name}.`)
      }
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const ta = composerRef.current
    if (!ta) return
    const text = ta.value.trim()
    if ((!text && attachments.length === 0) || state.streaming) return
    ta.value = ''
    ta.style.height = 'auto'
    send(text, { skill: skillActiva, attachments })
    setAttachments([])
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
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }

  function fillSuggestion(text: string) {
    const ta = composerRef.current
    if (!ta) return
    ta.value = text
    ta.focus()
  }

  return (
    <div className='flex h-full flex-col bg-background'>
      {/* ---- Header ---- */}
      <header className='flex flex-none items-center justify-between gap-2 border-b px-4 py-2.5'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div className='flex size-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm'>
            <Bot size={16} />
          </div>
          <div className='min-w-0'>
            <div className='truncate text-sm font-semibold leading-tight'>
              Asistente ZentoryERP
            </div>
            <div className='flex items-center gap-1.5 text-[11px] text-muted-foreground'>
              <Sparkles size={11} className='text-amber-500' />
              {ASISTENTE_MODEL_LABEL}
              {contextPct > 0 && <span>· contexto {contextPct}%</span>}
            </div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {contextPct >= 70 && (
            <Badge
              variant='outline'
              className={cn(
                'hidden sm:inline-flex text-[10px]',
                contextPct >= 90
                  ? 'border-red-400 text-red-600'
                  : 'border-amber-400 text-amber-600'
              )}
            >
              contexto {contextPct}%
            </Badge>
          )}
          <SkillPicker
            active={skillActiva}
            onChange={handleSkillChange}
            lastUserMessage={lastUserMessage}
          />
        </div>
      </header>

      {/* barra fina de uso de contexto */}
      {contextPct > 0 && (
        <div className='h-0.5 w-full flex-none bg-muted'>
          <div
            className={cn(
              'h-full transition-all',
              contextPct >= 90
                ? 'bg-red-500'
                : contextPct >= 70
                  ? 'bg-amber-500'
                  : 'bg-primary/50'
            )}
            style={{ width: `${contextPct}%` }}
          />
        </div>
      )}

      {/* ---- Mensajes ---- */}
      <ScrollArea className='flex-1'>
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6'>
          {state.messages.length === 0 && !state.streaming && (
            <div className='flex flex-col items-center gap-6 py-16 text-center'>
              <div className='flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md'>
                <Bot size={26} />
              </div>
              <div>
                <h2 className='text-xl font-semibold'>¿En qué te ayudo hoy?</h2>
                <p className='mt-1 text-sm text-muted-foreground'>
                  Consulta tu ERP, busca precios en internet o adjunta un PDF /
                  imagen para analizarlo.
                </p>
              </div>
              <div className='flex flex-wrap items-center justify-center gap-2'>
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    type='button'
                    onClick={() => fillSuggestion(text)}
                    className='flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-foreground'
                  >
                    <Icon size={13} className='text-primary' />
                    {text}
                  </button>
                ))}
              </div>
              {skillActiva && (
                <p className='text-xs text-muted-foreground'>
                  Modo activo: <strong>{skillActiva}</strong>
                </p>
              )}
            </div>
          )}

          {state.messages.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}

          {(runningTools.length > 0 || pendingTool) && state.streaming && (
            <div className='flex flex-wrap gap-2 ps-11'>
              {runningTools.map((t) => (
                <span
                  key={t.call_id}
                  className='inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground'
                >
                  {t.tool_name === 'web_search' ? (
                    <Globe size={11} className='animate-pulse text-primary' />
                  ) : (
                    <Wrench size={11} className='animate-pulse text-primary' />
                  )}
                  {t.tool_name}
                </span>
              ))}
              {pendingTool && (
                <button
                  type='button'
                  onClick={() => setDismissedSig(null)}
                  className='inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-50 px-3 py-1 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                >
                  <Loader2 size={11} className='animate-spin' />
                  esperando tu confirmación: {pendingTool.tool_name}
                </button>
              )}
            </div>
          )}

          {state.error && (
            <div className='rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'>
              {state.error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ---- Composer estilo ChatGPT ---- */}
      <form onSubmit={handleSubmit} className='flex-none px-4 pb-4 pt-1'>
        <div className='mx-auto w-full max-w-3xl'>
          <div className='rounded-[26px] border bg-card shadow-sm transition focus-within:border-primary/50 focus-within:shadow-md'>
            {attachments.length > 0 && (
              <div className='flex flex-wrap gap-2 px-4 pt-3'>
                {attachments.map((a, i) => (
                  <div
                    key={`${a.name}-${i}`}
                    className='group relative flex items-center gap-2 rounded-xl border bg-muted/40 px-2.5 py-1.5'
                  >
                    {a.dataUrl ? (
                      <img
                        src={a.dataUrl}
                        alt={a.name}
                        className='size-9 rounded-lg object-cover'
                      />
                    ) : (
                      <div className='flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500'>
                        <FileText size={16} />
                      </div>
                    )}
                    <span className='max-w-36 truncate text-xs'>{a.name}</span>
                    <button
                      type='button'
                      aria-label={`Quitar ${a.name}`}
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      className='flex size-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition group-hover:opacity-100'
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className='flex items-end gap-1.5 px-2.5 py-2'>
              <input
                ref={fileInputRef}
                type='file'
                multiple
                accept={ACCEPTED_TYPES.join(',')}
                className='hidden'
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='size-9 flex-none rounded-full text-muted-foreground hover:text-foreground'
                aria-label='Adjuntar PDF o imagen'
                disabled={state.streaming}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={18} />
              </Button>
              <textarea
                ref={composerRef}
                rows={1}
                onKeyDown={handleKey}
                onChange={autoResize}
                placeholder='Escribe un mensaje o adjunta un archivo...'
                className='max-h-52 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm focus:outline-none'
                disabled={state.streaming}
              />
              {state.streaming ? (
                <Button
                  type='button'
                  size='icon'
                  onClick={cancel}
                  aria-label='Detener generación'
                  className='size-9 flex-none rounded-full'
                >
                  <Square size={14} className='fill-current' />
                </Button>
              ) : (
                <Button
                  type='submit'
                  size='icon'
                  aria-label='Enviar'
                  className='size-9 flex-none rounded-full'
                >
                  <ArrowUp size={18} />
                </Button>
              )}
            </div>
          </div>
          <p className='mt-2 text-center text-[11px] text-muted-foreground'>
            {state.streaming ? (
              <span className='inline-flex items-center gap-1.5'>
                <Loader2 size={11} className='animate-spin' />
                Generando respuesta... (Esc para cancelar)
              </span>
            ) : (
              <>El asistente puede cometer errores. Verifica los datos importantes.</>
            )}
          </p>
        </div>
      </form>

      <ToolConfirmModal
        tool={pendingTool}
        open={!!pendingTool && pendingTool.sig !== dismissedSig}
        onOpenChange={(open) => {
          if (!open && pendingTool?.sig) setDismissedSig(pendingTool.sig)
        }}
      />
    </div>
  )
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className='flex flex-col items-end gap-1.5'>
        {message.attachments && message.attachments.length > 0 && (
          <div className='flex max-w-[75%] flex-wrap justify-end gap-2'>
            {message.attachments.map((a, i) =>
              a.dataUrl ? (
                <img
                  key={`${a.name}-${i}`}
                  src={a.dataUrl}
                  alt={a.name}
                  className='max-h-40 rounded-xl border object-cover'
                />
              ) : (
                <div
                  key={`${a.name}-${i}`}
                  className='flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2'
                >
                  <FileText size={14} className='text-red-500' />
                  <span className='max-w-40 truncate text-xs'>{a.name}</span>
                </div>
              )
            )}
          </div>
        )}
        {message.content && (
          <div className='max-w-[75%] whitespace-pre-wrap break-words rounded-3xl bg-muted px-4 py-2.5 text-sm'>
            {message.content}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='flex gap-3'>
      <div className='mt-0.5 flex size-8 flex-none items-center justify-center rounded-full border bg-card shadow-sm'>
        <Bot size={15} className='text-primary' />
      </div>
      <div className='min-w-0 flex-1 whitespace-pre-wrap break-words pt-1 text-sm leading-relaxed'>
        {message.content ||
          (message.streaming ? (
            <span className='inline-flex gap-1'>
              <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]' />
              <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]' />
              <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]' />
            </span>
          ) : null)}
      </div>
    </div>
  )
}
