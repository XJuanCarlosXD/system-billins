import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { McpUsageResponse } from '../api'

type Props = { data: McpUsageResponse['serie_temporal'] }

export function UsageTimeSeries({ data }: Props) {
  return (
    <div className="h-72 rounded-lg border p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="bucket" tickFormatter={(v: string) => v.slice(11, 16)} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="ok" stackId="a" fill="#10b981" name="OK" />
          <Bar dataKey="error" stackId="a" fill="#ef4444" name="Error" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
