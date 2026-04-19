"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import type { DailyGrowthPoint } from "@/lib/admin-kpis"

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

export function AdminGrowthChart({ data }: { data: DailyGrowthPoint[] }) {
  const p = APERCU_PALETTE
  return (
    <div className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
        >
          <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDayLabel}
            stroke={p.ink2 as string}
            fontSize={11}
            interval={4}
            tickMargin={8}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke={p.ink2 as string}
            fontSize={11}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: p.card,
              border: `1px solid ${p.line2}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(l) => formatDayLabel(String(l))}
            labelStyle={{ color: p.ink, fontWeight: 600 }}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: p.ink2 }}
          />
          <Line
            type="monotone"
            name="Nouveaux comptes"
            dataKey="users"
            stroke={p.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            name="Nouveaux foyers"
            dataKey="families"
            stroke="#5C8A5C"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
