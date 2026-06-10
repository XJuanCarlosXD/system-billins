import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function EmptySection({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Construction className="h-10 w-10 text-muted-foreground mb-3" />
        <div className="text-base font-medium">{title}</div>
        {description && <div className="text-sm text-muted-foreground mt-1 max-w-md">{description}</div>}
      </CardContent>
    </Card>
  )
}
