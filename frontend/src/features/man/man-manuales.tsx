import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ManManuales() {
  const { data = [] } = useQuery({ queryKey: ['man-manuales'], queryFn: () => api.manListManuales() })
  const [search, setSearch] = useState('')
  const filtered = (data as any[]).filter((m: any) =>
    !search ||
    m.descripcion_prg?.toLowerCase().includes(search.toLowerCase()) ||
    m.programa?.toLowerCase().includes(search.toLowerCase()) ||
    m.sistema?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input className="max-w-md h-9" placeholder="Buscar manual por sistema, programa o descripción…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="ml-auto text-sm text-muted-foreground">{filtered.length} de {data.length}</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((m: any, i: number) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-2">
                <Badge variant="outline">{m.sistema}</Badge>
                <Badge variant="secondary" className="font-mono text-xs">{m.programa}</Badge>
                <Badge variant="outline" className="text-xs">{m.tipo_prg}/{m.clase_prg}</Badge>
              </div>
              <CardTitle className="text-base pt-2">{m.descripcion_prg}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-72 overflow-y-auto">{m.detalle}</pre>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="text-muted-foreground py-6">Sin manuales.</div>}
      </div>
    </div>
  )
}
