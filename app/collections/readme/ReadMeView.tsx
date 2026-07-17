'use client'
import React, { useState, useEffect } from 'react'
import { BookOpen, Loader2 } from 'lucide-react'

interface ProjectField { field: string; notes: string | null }
interface SheetGuideRow { sheet: string; primary_user: string | null }
interface ReadmeSection {
  section: string
  title?: string
  subtitle?: string
  fields?: ProjectField[]
  rows?: SheetGuideRow[]
  text?: string
}

export default function ReadMeView() {
  const [sections, setSections] = useState<ReadmeSection[] | null>(null)

  useEffect(() => {
    fetch('/api/srmd/readme').then(r => r.json()).then(d => setSections(d.sections || []))
  }, [])

  if (!sections) {
    return (
      <div className="min-h-screen bg-[#F7F3ED] flex items-center justify-center text-[#5C1F2E]/40">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  const header      = sections.find(s => s.section === 'header')
  const projectInfo = sections.find(s => s.section === 'project_info')?.fields || []
  const sheetGuide  = sections.find(s => s.section === 'sheet_guide')?.rows || []
  const keyRules    = sections.find(s => s.section === 'key_rules')?.text

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#5C1F2E] pb-16 font-sans">
      <header className="bg-white py-4 px-6 sticky top-0 z-30 border-b border-[#E8E3DB]">
        <div className="flex items-center gap-3">
          <div className="bg-[#5C1F2E] text-white p-2 rounded-lg">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-[#5C1F2E] tracking-tight leading-none">Read Me</h1>
            <p className="text-[10px] font-mono text-[#5C1F2E]/40 mt-1">SRMD Workbook · 00_Read_Me</p>
          </div>
        </div>
      </header>

      <div className="px-6 lg:px-8 py-6 space-y-5 max-w-3xl">
        {header && (
          <div className="bg-white border border-[#E8E3DB]/70 rounded-xl p-5">
            <h2 className="font-serif text-xl font-bold text-[#5C1F2E]">{String(header.title || '')}</h2>
            <p className="text-[#5C1F2E]/60 text-sm mt-1">{String(header.subtitle || '')}</p>
          </div>
        )}

        {projectInfo.length > 0 && (
          <div className="bg-white border border-[#E8E3DB]/70 rounded-xl p-5 space-y-3">
            <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block">Project Info</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {projectInfo.map(({ field, notes }) => (
                <div key={field} className="min-w-0">
                  <span className="text-[9px] font-mono text-stone-400 block uppercase font-bold">{field.replace(/_/g, ' ')}</span>
                  <span className="font-medium text-stone-800 mt-0.5 block break-words">{String(notes ?? '—')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sheetGuide.length > 0 && (
          <div className="bg-white border border-[#E8E3DB]/70 rounded-xl overflow-hidden">
            <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-wider block px-5 pt-5 pb-2">Sheet Guide</span>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-y border-[#E8E3DB] bg-[#FAF8F5]">
                  <th className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-[#5C1F2E]/50">Sheet</th>
                  <th className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-[#5C1F2E]/50">Primary User</th>
                </tr>
              </thead>
              <tbody>
                {sheetGuide.map(({ sheet, primary_user }) => (
                  <tr key={sheet} className="border-b border-[#E8E3DB]/50 last:border-0">
                    <td className="px-5 py-2 font-mono text-[11px]">{sheet}</td>
                    <td className="px-5 py-2">{primary_user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {keyRules && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <span className="text-[9px] font-mono font-bold text-amber-700 uppercase tracking-wider block mb-1.5">Key Rules</span>
            <p className="text-amber-900 text-xs leading-relaxed">{keyRules}</p>
          </div>
        )}
      </div>
    </div>
  )
}
