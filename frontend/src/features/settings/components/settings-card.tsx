import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SettingsItem } from '../data/settings-catalog'

type SettingsCardProps = {
  item: SettingsItem
}

export function SettingsCard({ item }: SettingsCardProps) {
  const linkProps =
    item.search != null
      ? ({ to: item.to, search: item.search } as any)
      : ({ to: item.to } as any)

  return (
    <Card className='group transition-colors hover:border-foreground/30'>
      <Link {...linkProps} className='block'>
        <CardHeader className='pb-2'>
          <div className='flex items-start justify-between gap-2'>
            <CardTitle className='text-base'>{item.title}</CardTitle>
            {item.inline ? (
              <Sparkles className='h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100' />
            ) : (
              <ArrowUpRight className='h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100' />
            )}
          </div>
        </CardHeader>
        {item.description && (
          <CardContent className='pt-0'>
            <CardDescription className='text-xs leading-relaxed'>
              {item.description}
            </CardDescription>
          </CardContent>
        )}
      </Link>
    </Card>
  )
}
