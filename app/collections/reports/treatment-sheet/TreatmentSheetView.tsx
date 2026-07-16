'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface TreatmentDoc { Treatment_ID: string; Object_ID?: string; Action_Type?: string; [k: string]: unknown }
interface Bundle {
  treatment: TreatmentDoc
  inventory: Record<string, unknown> | null
  condition: Record<string, unknown> | null
}

function fmt(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d.toLocaleDateString()
  }
  return String(v)
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2 text-sm even:bg-[#FAF8F5]">
      <span className="text-[#1B3A2E]/70 font-semibold">{label}</span>
      <span className="text-[#1B3A2E] text-right break-words">{fmt(value)}</span>
    </div>
  )
}

export default function TreatmentSheetView() {
  const [allTreatments, setAllTreatments] = useState<TreatmentDoc[]>([])
  const [treatmentsLoading, setTreatmentsLoading] = useState(true)
  const [treatmentId, setTreatmentId] = useState<string>('')
  const [bundle, setBundle]           = useState<Bundle | null>(null)
  const [loading, setLoading]         = useState(false)

  // Populate the dropdown itself straight from Treatment Recommendations — no
  // typing required to see what's available, matching the workbook's own selector cell.
  useEffect(() => {
    setTreatmentsLoading(true)
    fetch('/api/srmd/treatments?limit=500')
      .then(r => r.json())
      .then(d => setAllTreatments(d.items || []))
      .finally(() => setTreatmentsLoading(false))
  }, [])

  useEffect(() => {
    if (!treatmentId) { setBundle(null); return }
    setLoading(true)
    fetch(`/api/srmd/treatment-sheet/${encodeURIComponent(treatmentId)}`)
      .then(r => r.json())
      .then(d => setBundle(d.error ? null : d))
      .finally(() => setLoading(false))
  }, [treatmentId])

  const handleDownloadPdf = useCallback(() => {
    if (!bundle) return
    const element = document.querySelector<HTMLElement>('.print-sheet')
    if (element) {
      import('html2pdf.js').then(html2pdf => {
        const opt = {
          margin: 0.5,
          filename: `treatment-sheet-${bundle.treatment.Treatment_ID}.pdf`,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
        }
        html2pdf.default().from(element).set(opt).save()
      })
    }
  }, [bundle])


  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#1B3A2E] pb-16 font-sans">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-sheet { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <header className="bg-white py-4 px-6 sticky top-0 z-30 border-b border-[#E8E3DB] no-print">
        <div className="flex items-center justify-end">
          {bundle && (
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B3A2E] hover:bg-[#2D5C45] text-white text-xs font-semibold rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
          )}
        </div>
      </header>

      <div className="px-6 lg:px-8 py-6 space-y-5 max-w-2xl">
        {/* Treatment ID selector — a real dropdown populated from Treatment Recommendations,
            not a type-to-search box, so it's usable even with only a handful of records. */}
        <div className="no-print">
          <label className="text-xs font-bold text-[#1B3A2E]/70 block mb-1.5">Treatment ID (selector)</label>
          <select
            value={treatmentId}
            onChange={e => setTreatmentId(e.target.value)}
            disabled={treatmentsLoading}
            className="w-full bg-white text-xs font-medium py-2.5 px-3 rounded-lg border border-[#E8E3DB] focus:outline-none focus:ring-1 focus:ring-[#1B3A2E]/30 text-[#1B3A2E] cursor-pointer disabled:opacity-50"
          >
            <option value="">
              {treatmentsLoading ? 'Loading treatments…' : allTreatments.length === 0 ? 'No treatments recorded yet' : '— Select a Treatment ID —'}
            </option>
            {allTreatments.map(t => (
              <option key={t.Treatment_ID} value={t.Treatment_ID}>
                {t.Treatment_ID}{t.Action_Type ? ` — ${t.Action_Type}` : ''}{t.Object_ID ? ` (${t.Object_ID})` : ''}
              </option>
            ))}
          </select>
          {!treatmentsLoading && allTreatments.length === 0 && (
            <p className="text-[10px] text-[#1B3A2E]/40 mt-1.5">
              Add entries in the Treatment Recommendations view first — they'll show up here.
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-[#1B3A2E]/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading treatment…
          </div>
        )}

        {!loading && !bundle && (
          <div className="bg-white border border-[#E8E3DB] rounded-xl p-10 text-center text-[#1B3A2E]/40 text-sm no-print">
            Select a Treatment ID above to generate its treatment sheet.
          </div>
        )}

        {bundle && (
          <div className="print-sheet bg-white border border-[#E8E3DB] rounded-xl overflow-hidden">
            <div className="bg-[#1B3A2E] text-white px-6 py-4">
              <h2 className="font-serif text-lg font-bold">SRMD · Treatment / Rehousing Sheet</h2>
              <p className="text-[10px] font-mono text-white/70 mt-1 uppercase tracking-wider">Treatment ID: {bundle.treatment.Treatment_ID}</p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <div className="bg-[#1B3A2E] text-white text-xs font-bold px-3 py-1.5 rounded-t-lg">Object Header</div>
                <div className="border border-t-0 border-[#E8E3DB] rounded-b-lg overflow-hidden divide-y divide-[#E8E3DB]/60">
                  <Row label="Object_ID" value={bundle.treatment.Object_ID} />
                  <Row label="Object Name" value={bundle.inventory?.Object_Name} />
                  <Row label="Collection Type" value={bundle.inventory?.Collection_Type} />
                  <Row label="Current Location" value={bundle.inventory?.Current_Location_ID} />
                </div>
              </div>

              <div>
                <div className="bg-[#1B3A2E] text-white text-xs font-bold px-3 py-1.5 rounded-t-lg">Condition</div>
                <div className="border border-t-0 border-[#E8E3DB] rounded-b-lg overflow-hidden divide-y divide-[#E8E3DB]/60">
                  <Row label="Overall Condition" value={bundle.condition?.Overall_Condition} />
                  <Row label="Condition Summary" value={bundle.condition?.Condition_Summary} />
                </div>
              </div>

              <div>
                <div className="bg-[#1B3A2E] text-white text-xs font-bold px-3 py-1.5 rounded-t-lg">Proposed Action</div>
                <div className="border border-t-0 border-[#E8E3DB] rounded-b-lg overflow-hidden divide-y divide-[#E8E3DB]/60">
                  <Row label="Action Type" value={bundle.treatment.Action_Type} />
                  <Row label="Action Level" value={bundle.treatment.Action_Level} />
                  <Row label="Reason for Action" value={bundle.treatment.Reason_for_Action} />
                  <Row label="Estimated Hours" value={bundle.treatment.Estimated_Hours} />
                  <Row label="Materials" value={bundle.treatment.Materials_or_Supplies} />
                </div>
              </div>

              <div>
                <div className="bg-[#1B3A2E] text-white text-xs font-bold px-3 py-1.5 rounded-t-lg">Approval &amp; Completion</div>
                <div className="border border-t-0 border-[#E8E3DB] rounded-b-lg overflow-hidden divide-y divide-[#E8E3DB]/60">
                  <Row label="Recommended By" value={bundle.treatment.Recommended_By} />
                  <Row label="Approval Status" value={bundle.treatment.Approval_Status} />
                  <Row label="Assigned To" value={bundle.treatment.Assigned_To} />
                  <Row label="Completion Date" value={bundle.treatment.Completion_Date} />
                  <Row label="Outcome Summary" value={bundle.treatment.Outcome_Summary} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
