import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  type SettingsCategory,
  type SettingsItem,
  itemMatchesQuery,
} from '../data/settings-catalog'

type SettingsTreeProps = {
  categories: SettingsCategory[]
  activeSlug?: string
  onSelect: (slug: string) => void
  query?: string
}

export function SettingsTree({
  categories,
  activeSlug,
  onSelect,
  query,
}: SettingsTreeProps) {
  const needle = (query ?? '').trim()

  // Pre-calcula que categorias tienen match para la query — antes esto se
  // recorria por cada render del nodo (triple-loop O(cats × groups × items))
  // disparado en cada keystroke. Ahora memoizado por [categories, needle].
  const matchByCat = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const c of categories) {
      let hit = false
      outer: for (const g of c.groups) {
        for (const it of g.items) {
          if (itemMatchesQuery(it, c.title, g.title, needle)) {
            hit = true
            break outer
          }
        }
      }
      m[c.id] = hit
    }
    return m
  }, [categories, needle])

  // Items visibles por (categoria, grupo) — memoizado tambien.
  const visibleItemsByGroup = useMemo(() => {
    const m: Record<string, SettingsItem[]> = {}
    for (const c of categories) {
      for (const g of c.groups) {
        m[`${c.id}|${g.title}`] = g.items.filter((it) =>
          itemMatchesQuery(it, c.title, g.title, needle),
        )
      }
    }
    return m
  }, [categories, needle])

  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const c of categories) initial[c.id] = false
    initial[categories[0]?.id ?? ''] = true
    if (activeSlug) {
      for (const c of categories) {
        for (const g of c.groups) {
          if (g.items.some((it) => it.slug === activeSlug)) initial[c.id] = true
        }
      }
    }
    return initial
  })

  useEffect(() => {
    if (!activeSlug) return
    setOpenCats((prev) => {
      const next = { ...prev }
      let changed = false
      for (const c of categories) {
        for (const g of c.groups) {
          if (g.items.some((it) => it.slug === activeSlug) && !prev[c.id]) {
            next[c.id] = true
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [activeSlug, categories])

  useEffect(() => {
    if (!needle) return
    setOpenCats((prev) => {
      const next = { ...prev }
      let changed = false
      for (const c of categories) {
        if (matchByCat[c.id] && !prev[c.id]) {
          next[c.id] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [needle, categories, matchByCat])

  const toggleCat = (id: string) =>
    setOpenCats((p) => ({ ...p, [id]: !p[id] }))

  return (
    <ScrollArea className='h-full'>
      <nav className='flex flex-col py-2 text-sm'>
        {categories.map((cat) => {
          const Icon = cat.icon
          const open = !!openCats[cat.id]
          const matches = matchByCat[cat.id]
          if (needle && !matches) return null
          return (
            <div key={cat.id} className='select-none'>
              <Button
                variant='ghost'
                onClick={() => toggleCat(cat.id)}
                className='h-7 w-full justify-start gap-1.5 px-2 py-0 text-sm font-medium'
              >
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground',
                    open && 'rotate-90'
                  )}
                />
                <Icon className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                <span className='truncate'>{cat.title}</span>
              </Button>
              {open && (
                <div className='flex flex-col'>
                  {cat.groups.map((g) => {
                    const visibleItems = visibleItemsByGroup[`${cat.id}|${g.title}`] || []
                    if (visibleItems.length === 0) return null
                    return (
                      <div key={g.title}>
                        {cat.groups.length > 1 && (
                          <div className='mt-1 ps-7 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
                            {g.title}
                          </div>
                        )}
                        {visibleItems.map((it) => {
                          const active = it.slug === activeSlug
                          return (
                            <button
                              key={it.slug}
                              onClick={() => onSelect(it.slug)}
                              className={cn(
                                'flex w-full items-center gap-2 truncate rounded-sm px-2 py-1 ps-7 text-left text-sm transition-colors',
                                active
                                  ? 'bg-accent text-accent-foreground'
                                  : 'text-foreground/80 hover:bg-muted'
                              )}
                            >
                              <span className='truncate'>{it.title}</span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </ScrollArea>
  )
}
