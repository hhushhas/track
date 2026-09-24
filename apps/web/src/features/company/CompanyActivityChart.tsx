import type { FunctionReturnType } from 'convex/server'
import { useEffect, useRef } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { api } from '../../../../../convex/_generated/api'

type Trend = NonNullable<FunctionReturnType<typeof api.companyOverview.get>>['activityTrend']

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
}

function axisLabel(value: string, days: 7 | 30 | 90) {
  const options: Intl.DateTimeFormatOptions = days === 7
    ? { weekday: 'short', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', timeZone: 'UTC' }
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T00:00:00Z`))
}

export function CompanyActivityChart({ days, trend }: { days: 7 | 30 | 90; trend: Trend }) {
  const minWidth = days === 7 ? 0 : trend.length * (days === 30 ? 24 : 18)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (days === 7) return
    const scrollToRecent = () => {
      const scroll = scrollRef.current
      if (scroll) scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth
    }
    const frame = requestAnimationFrame(scrollToRecent)
    const observer = new ResizeObserver(scrollToRecent)
    if (scrollRef.current) observer.observe(scrollRef.current)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [days, trend])

  return <>
    <div aria-label="Created and completed tasks by day. Scroll horizontally to explore earlier dates." className="company-dashboard-chart-scroll" ref={scrollRef} role="group" tabIndex={0}>
      <div className="company-dashboard-recharts" style={{ minWidth }}>
        <ResponsiveContainer height="100%" width="100%">
          <BarChart accessibilityLayer barCategoryGap="24%" barGap={3} data={trend} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--company-ref-border)" strokeDasharray="3 4" vertical={false} />
            <XAxis axisLine={false} dataKey="date" interval={days === 7 ? 0 : days === 30 ? 4 : 13} tick={{ fill: 'var(--company-ref-muted)', fontSize: 10 }} tickFormatter={(value: string) => axisLabel(value, days)} tickLine={false} tickMargin={8} />
            <YAxis allowDecimals={false} axisLine={false} domain={[0, (maximum: number) => Math.max(2, maximum)]} tick={{ fill: 'var(--company-ref-muted)', fontSize: 10 }} tickCount={3} tickLine={false} width={28} />
            <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--company-ref-border-strong)', borderRadius: 8, color: 'var(--popover-foreground)', fontSize: 12 }} cursor={{ fill: 'var(--paper-2)' }} labelFormatter={(value) => dateLabel(String(value))} />
            <Bar dataKey="created" fill="#fbbf24" isAnimationActive={false} maxBarSize={14} name="Created" radius={[2, 2, 0, 0]} />
            <Bar dataKey="completed" fill="#10b981" isAnimationActive={false} maxBarSize={14} name="Completed" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div aria-hidden="true" className="company-dashboard-chart-legend"><span><i className="created" />Created</span><span><i className="completed" />Completed</span></div>
    <div className="sr-only">
      <table>
        <caption>Created and completed tasks by day</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Created</th><th scope="col">Completed</th></tr></thead>
        <tbody>{trend.map((point) => <tr key={point.date}><th scope="row">{dateLabel(point.date)}</th><td>{point.created}</td><td>{point.completed}</td></tr>)}</tbody>
      </table>
    </div>
  </>
}
