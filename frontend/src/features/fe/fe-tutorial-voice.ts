import { useCallback, useEffect, useRef, useState } from 'react'

export function useTTS() {
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    try {
      setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
    } catch {
      setSupported(false)
    }
  }, [])

  const stop = useCallback(() => {
    try {
      window.speechSynthesis?.cancel()
      utterRef.current = null
    } catch {
      // ignore
    }
  }, [])

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      try {
        if (!('speechSynthesis' in window)) {
          onEnd?.()
          return
        }
        window.speechSynthesis.cancel()
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = 'es-MX'
        utter.rate = 0.95
        utter.pitch = 1.0
        const voices = window.speechSynthesis.getVoices()
        const esVoice =
          voices.find((v) => v.lang === 'es-MX') ||
          voices.find((v) => v.lang === 'es-ES') ||
          voices.find((v) => v.lang.startsWith('es'))
        if (esVoice) utter.voice = esVoice
        utter.onend = () => {
          onEnd?.()
        }
        utter.onerror = () => {
          onEnd?.()
        }
        utterRef.current = utter
        window.speechSynthesis.speak(utter)
      } catch {
        onEnd?.()
      }
    },
    [],
  )

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel()
      } catch {
        // ignore
      }
    }
  }, [])

  return { speak, stop, supported }
}
