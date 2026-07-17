'use client'
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { hasEditAccess, type ViewPermissions } from '@/lib/permissions'

interface Row { label: string; count: number }
interface Section { title: string; rows: Row[] }
interface ReportData { month: string; sections: Section[]; notes: string }

export interface MonthlyReportViewHandle {
  downloadPdf: () => void
}

function defaultMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

const MonthlyReportView = forwardRef<MonthlyReportViewHandle>(function MonthlyReportView(_props, ref) {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const permissions = (session?.user as { permissions?: ViewPermissions | null } | undefined)?.permissions
  const canEdit = hasEditAccess(role, permissions, 'collections')

  const [month, setMonth]     = useState(defaultMonth())
  const [data, setData]       = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingNotes, setSavingNotes] = useState(false)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const d = await fetch(`/api/srmd/monthly-report?month=${encodeURIComponent(m)}`).then(r => r.json())
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [month, load])

  async function saveNotes(notes: string) {
    setSavingNotes(true)
    try {
      await fetch('/api/srmd/monthly-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, notes }),
      })
    } finally {
      setSavingNotes(false)
    }
  }

  const handleDownloadPdf = useCallback(() => {
    const element = document.querySelector('.print-sheet') as HTMLElement
    if (element) {
      import('html2pdf.js').then(html2pdf => {
        const opt = {
          margin: 0.5,
          filename: `monthly-report-${month}.pdf`,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
        }
        html2pdf.default().from(element).set(opt).save()
      })
    }
  }, [month])

  useImperativeHandle(ref, () => ({ downloadPdf: handleDownloadPdf }), [handleDownloadPdf])

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#1B3A2E] pb-16 font-sans">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-sheet { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="px-6 lg:px-8 py-6 space-y-5 max-w-3xl">
        <div className="flex items-center gap-3 no-print">
          <label className="text-xs font-bold text-[#1B3A2E]/70">Report Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-xs font-semibold py-2 px-3 rounded-lg border border-[#E8E3DB] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30"
          />
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-24 text-[#1B3A2E]/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading report…
          </div>
        ) : (
          <div className="print-sheet bg-white border border-[#E8E3DB] rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(27,58,46,0.08)]">
            <div className="bg-[#1B3A2E] text-white px-6 py-4">
              <h2 className="font-serif text-lg font-bold">SRMD Collection Assessment · Monthly Report</h2>
              <p className="text-[10px] font-mono text-white/70 mt-1 uppercase tracking-wider">Report Month: {data.month}</p>
            </div>

            <div className="p-6 space-y-5">
              {data.sections.map(section => (
                <div key={section.title}>
                  <div className="bg-[#1B3A2E] text-white text-xs font-bold px-3 py-1.5 rounded-t-lg">{section.title}</div>
                  <div className="border border-t-0 border-[#E8E3DB] rounded-b-lg overflow-hidden">
                    {section.rows.map((row, i) => (
                      <div
                        key={row.label}
                        className={`flex items-center justify-between px-3 py-2 text-sm ${i % 2 === 0 ? 'bg-[#FAF8F5]' : 'bg-white'}`}
                      >
                        <span className="text-[#1B3A2E]/80">{row.label}</span>
                        <span className="font-mono font-bold text-[#1B3A2E]">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <div className="bg-[#1B3A2E] text-white text-xs font-bold px-3 py-1.5 rounded-t-lg">Notes / Decisions Needed</div>
                <textarea
                  defaultValue={data.notes}
                  key={data.month}
                  onBlur={e => saveNotes(e.target.value)}
                  placeholder="Add notes or decisions needed for this month…"
                  rows={5}
                  disabled={!canEdit}
                  className="w-full text-sm p-3 border border-t-0 border-[#E8E3DB] rounded-b-lg focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 resize-none disabled:opacity-70 disabled:cursor-not-allowed"
                />
                {savingNotes && <p className="text-[10px] font-mono text-[#1B3A2E]/40 mt-1 no-print">Saving…</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default MonthlyReportView
