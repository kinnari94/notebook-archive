'use client'
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { HANDOVER_STATUS_OPTIONS } from '@/lib/handover-checklist'
import { hasEditAccess, type ViewPermissions } from '@/lib/permissions'
import { useDropdownOptions } from '@/lib/useDropdownOptions'
import SelectWithAdd from '@/components/SelectWithAdd'

interface ChecklistRow {
  item: string
  order: number
  status: string
  date: string
  notes: string
}

export interface HandoverChecklistViewHandle {
  downloadPdf: () => void
}

const HandoverChecklistView = forwardRef<HandoverChecklistViewHandle>(function HandoverChecklistView(_props, ref) {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const permissions = (session?.user as { permissions?: ViewPermissions | null } | undefined)?.permissions
  const canEdit = hasEditAccess(role, permissions, 'collections')
  const { optionSets, customValues, addOption, deleteOption } = useDropdownOptions()
  const statusOptions = optionSets.HANDOVER_STATUS ?? HANDOVER_STATUS_OPTIONS

  const [rows, setRows] = useState<ChecklistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch('/api/srmd/handover-checklist').then(r => r.json())
      setRows(d.items || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function save(item: string, patch: Partial<Pick<ChecklistRow, 'status' | 'date' | 'notes'>>) {
    setRows(prev => prev.map(r => r.item === item ? { ...r, ...patch } : r))
    setSavingItem(item)
    try {
      await fetch('/api/srmd/handover-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, ...patch }),
      })
    } finally {
      setSavingItem(prev => prev === item ? null : prev)
    }
  }

  const handleDownloadPdf = useCallback(() => {
    const element = document.querySelector('.print-sheet') as HTMLElement | null
    if (element) {
      import('html2pdf.js').then(html2pdf => {
        const opt = {
          margin: 0.5,
          filename: 'handover-checklist.pdf',
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
        }
        html2pdf.default().from(element).set(opt).save()
      })
    }
  }, [])

  useImperativeHandle(ref, () => ({ downloadPdf: handleDownloadPdf }), [handleDownloadPdf])

  const doneCount = rows.filter(r => r.status === 'Done').length

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#1B3A2E] pb-16 font-sans">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-sheet { box-shadow: none !important; border: none !important; }
          select, input { border: none !important; background: transparent !important; }
        }
      `}</style>

      <div className="px-6 lg:px-8 py-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
          <div className="bg-white border border-[#E8E3DB]/70 rounded-xl p-4">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#1B3A2E]/40 block">Items Done</span>
            <span className="text-2xl font-semibold font-mono text-[#1B3A2E] block mt-1">{doneCount} / {rows.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#1B3A2E]/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading checklist…
          </div>
        ) : (
          <div className="print-sheet bg-white border border-[#E8E3DB] rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(27,58,46,0.08)]">
            <div className="bg-[#1B3A2E] text-white px-6 py-3">
              <h2 className="font-serif text-lg font-bold">SRMD Collection Assessment · Handover Checklist</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E3DB] bg-[#FAF8F5] text-left">
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#1B3A2E]/50 w-1/2">Item</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#1B3A2E]/50">Status</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#1B3A2E]/50">Date</th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#1B3A2E]/50">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.item} className="border-b border-[#E8E3DB]/60 last:border-0 align-top">
                    <td className="px-4 py-3 text-[#1B3A2E]">{r.item}</td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        {canEdit ? (
                          <SelectWithAdd
                            value={r.status}
                            onChange={v => save(r.item, { status: v })}
                            options={statusOptions}
                            canAdd={canEdit}
                            onAddOption={v => addOption('HANDOVER_STATUS', v)}
                            customValues={customValues.HANDOVER_STATUS}
                            onDeleteOption={v => deleteOption('HANDOVER_STATUS', v)}
                            className={`text-xs font-semibold py-1.5 px-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 ${
                              r.status === 'Done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : r.status === 'In Progress' ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-[#fcfbfa] border-[#eae4da] text-[#1B3A2E]'
                            }`}
                          />
                        ) : (
                          <select
                            value={r.status}
                            disabled
                            className={`text-xs font-semibold py-1.5 px-2 rounded-lg border focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed ${
                              r.status === 'Done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : r.status === 'In Progress' ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-[#fcfbfa] border-[#eae4da] text-[#1B3A2E]'
                            }`}
                          >
                            <option value="">—</option>
                            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={r.date}
                        onChange={e => save(r.item, { date: e.target.value })}
                        disabled={!canEdit}
                        className="text-xs font-semibold py-1.5 px-2 rounded-lg border border-[#eae4da] bg-[#fcfbfa] focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        defaultValue={r.notes}
                        onBlur={e => save(r.item, { notes: e.target.value })}
                        placeholder="—"
                        disabled={!canEdit}
                        className="w-full text-xs font-medium py-1.5 px-2 rounded-lg border border-[#eae4da] bg-[#fcfbfa] focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {savingItem && (
              <div className="px-4 py-2 text-[10px] font-mono text-[#1B3A2E]/40 no-print">Saving…</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

export default HandoverChecklistView
