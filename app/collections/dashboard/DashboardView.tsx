'use client'
import React, { useState, useEffect } from 'react'
import { Loader2, Check, TriangleAlert } from 'lucide-react'

interface DashboardData {
  stats: {
    totalRecords: number; pctConditionsDone: number; pctComplete: number
    immediateActions: number; criticalObjects: number; envAlerts: number
    photosLogged: number; treatmentsPending: number
  }
  collectionTypeBreakdown: { label: string; count: number }[]
  priorityBandBreakdown: { label: string; count: number }[]
  conditionBreakdown: { label: string; count: number }[]
  treatmentStatusBreakdown: { label: string; count: number }[]
  dataQualityChecks: { label: string; count: number; status: 'ok' | 'review' }[]
  environmentalAlerts: Record<string, unknown>[]
}

function StatTile({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-[#E8E3DB]/70'}`}>
      <span className={`text-[9px] font-mono uppercase tracking-wider block ${highlight ? 'text-red-700/70' : 'text-[#1B3A2E]/40'}`}>{label}</span>
      <span className={`text-2xl font-semibold font-mono block mt-1 ${highlight ? 'text-red-700' : 'text-[#1B3A2E]'}`}>{value}</span>
    </div>
  )
}

function Breakdown({ title, rows, barClass }: { title: string; rows: { label: string; count: number }[]; barClass?: (label: string) => string }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div className="bg-white border border-[#E8E3DB]/70 rounded-xl p-5">
      <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block mb-3">{title}</span>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 truncate text-[#1B3A2E]/70">{r.label}</span>
            <div className="flex-1 h-2 bg-[#F7F3ED] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barClass ? barClass(r.label) : 'bg-[#1B3A2E]'}`} style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right font-mono text-[#1B3A2E]">{r.count}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-[#1B3A2E]/40 text-xs">No data yet.</p>}
      </div>
    </div>
  )
}

const CONDITION_BAR_CLASS: Record<string, string> = {
  Critical: 'bg-red-500', Poor: 'bg-orange-400', Fair: 'bg-amber-400', Good: 'bg-teal-400', Stable: 'bg-emerald-400',
}

export default function DashboardView() {
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/srmd/dashboard').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#1B3A2E] pb-16 font-sans">
      {loading || !data ? (
        <div className="flex items-center justify-center py-24 text-[#1B3A2E]/40">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="px-6 lg:px-8 py-6 space-y-5">

          {/* Top stat strip — matches the workbook's own 10_Dashboard row of tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatTile label="Total Records"     value={data.stats.totalRecords} />
            <StatTile label="% Conditions Done" value={`${data.stats.pctConditionsDone}%`} />
            <StatTile label="% Complete"        value={`${data.stats.pctComplete}%`} />
            <StatTile label="Immediate Actions" value={data.stats.immediateActions} highlight={data.stats.immediateActions > 0} />
            <StatTile label="Critical Objects"  value={data.stats.criticalObjects}  highlight={data.stats.criticalObjects > 0} />
            <StatTile label="Env Alerts"        value={data.stats.envAlerts} />
            <StatTile label="Photos Logged"     value={data.stats.photosLogged} />
            <StatTile label="Treatments Pending" value={data.stats.treatmentsPending} />
          </div>

          {/* Four breakdown panels — Records by Collection Type / Priority Band /
              Condition Overview (color-coded) / Treatment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Breakdown title="Records by Collection Type" rows={data.collectionTypeBreakdown} />
            <Breakdown title="Priority Band Summary" rows={data.priorityBandBreakdown} />
            <Breakdown
              title="Condition Overview"
              rows={data.conditionBreakdown}
              barClass={label => CONDITION_BAR_CLASS[label] || 'bg-[#1B3A2E]'}
            />
            <Breakdown title="Treatment Status" rows={data.treatmentStatusBreakdown} />
          </div>

          {/* Data Quality Checks + Environmental Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#E8E3DB]/70 rounded-xl p-5">
              <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block mb-3">Data Quality Checks</span>
              <div className="space-y-2">
                {data.dataQualityChecks.map(c => (
                  <div key={c.label} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-stone-100 last:border-0">
                    <span className="text-[#1B3A2E]/80">{c.label}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-[#1B3A2E] w-8 text-right">{c.count}</span>
                      {c.status === 'ok' ? (
                        <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          <Check className="w-3 h-3" /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          <TriangleAlert className="w-3 h-3" /> Review
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#E8E3DB]/70 rounded-xl p-5">
              <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block mb-3">Environmental Alerts</span>
              {data.environmentalAlerts.length === 0 ? (
                <p className="text-[#1B3A2E]/40 text-xs py-2">No environmental alerts logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-stone-150 text-[9px] font-mono uppercase tracking-wider text-stone-400">
                        <th className="text-left py-1.5 pr-3">Location</th>
                        <th className="text-left py-1.5 pr-3">Period</th>
                        <th className="text-left py-1.5 pr-3">Profile</th>
                        <th className="text-left py-1.5 pr-3">RH Max</th>
                        <th className="text-left py-1.5">Alert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.environmentalAlerts.map((r, i) => (
                        <tr key={i} className="border-b border-stone-100 last:border-0">
                          <td className="py-1.5 pr-3">{String(r.Location_ID ?? '—')}</td>
                          <td className="py-1.5 pr-3">{String(r.Summary_Period_Start ?? '—')}</td>
                          <td className="py-1.5 pr-3">{String(r.Threshold_Profile ?? '—')}</td>
                          <td className="py-1.5 pr-3">{String(r.RH_Max ?? '—')}</td>
                          <td className="py-1.5 text-red-600 font-semibold">{String(r.Alert_Flag ?? '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
