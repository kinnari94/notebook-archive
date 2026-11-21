'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'

export interface SourceNotebook {
  notebook_id: string
  notebook_title: string
  count: number
  sources: { id: string; title: string; count: number }[]
}

/**
 * Source filter: notebooks, each expandable (›) to its transcripts.
 * Value is "" (all), "nb:<notebook id>" (whole notebook) or "src:<source id>" (one transcript).
 */
export default function SourceFilter({ value, onChange, notebooks, label }: {
  value: string
  onChange: (v: string) => void
  notebooks: SourceNotebook[]
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  // When opening with a transcript selected, show it by expanding its notebook.
  useEffect(() => {
    if (!open || !value.startsWith('src:')) return
    const nb = notebooks.find(n => n.sources.some(s => `src:${s.id}` === value))
    if (nb) setExpanded(prev => prev.has(nb.notebook_id) ? prev : new Set(prev).add(nb.notebook_id))
  }, [open, value, notebooks])

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const pick = (v: string) => { onChange(v); setOpen(false) }

  const row = (active: boolean) =>
    `flex-1 min-w-0 text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${
      active ? 'bg-[#1C3D27]/5 text-[#1C3D27] font-bold' : 'text-stone-700 hover:bg-stone-50'}`
  const tick = (active: boolean) =>
    <Check className={`w-3 h-3 shrink-0 ${active ? 'text-[#1C3D27]' : 'invisible'}`} />

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={() => setOpen(v => !v)} title={label || 'All sources'}
        className="w-full bg-[#fcfbfa] text-[#1c1917] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1C3D27] border border-[#E9E4DF] flex items-center justify-between gap-2 text-left">
        <span className="truncate">{label || 'All Sources'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[min(22rem,calc(100vw-2rem))] bg-white border border-[#E9E4DF] rounded-xl shadow-lg z-30 max-h-80 overflow-y-auto p-1">
          <div className="flex">
            <button type="button" onClick={() => pick('')} className={row(value === '')}>
              {tick(value === '')}All Sources
            </button>
          </div>

          {notebooks.map(nb => {
            const isOpen = expanded.has(nb.notebook_id)
            const nbValue = `nb:${nb.notebook_id}`
            return (
              <div key={nb.notebook_id}>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => pick(nbValue)} className={row(value === nbValue)}>
                    {tick(value === nbValue)}
                    <span className="truncate">📓 {nb.notebook_title}</span>
                    <span className="ml-auto pl-2 font-mono text-[10px] text-stone-400 shrink-0">{nb.count}</span>
                  </button>
                  {nb.sources.length > 0 && (
                    <button type="button" onClick={() => toggle(nb.notebook_id)}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} transcripts in ${nb.notebook_title}`} aria-expanded={isOpen}
                      title={`${isOpen ? 'Hide' : 'Show'} ${nb.sources.length} transcripts`}
                      className="p-1.5 rounded-md text-stone-500 hover:text-[#1C3D27] hover:bg-stone-100 shrink-0">
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="ml-5 pl-2 border-l border-stone-200 mb-1">
                    {nb.sources.map(s => {
                      const v = `src:${s.id}`
                      return (
                        <div key={s.id} className="flex">
                          <button type="button" onClick={() => pick(v)} className={row(value === v)} title={s.title}>
                            {tick(value === v)}
                            <span className="truncate font-normal">{s.title}</span>
                            <span className="ml-auto pl-2 font-mono text-[10px] text-stone-400 shrink-0">{s.count}</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {notebooks.length === 0 && <p className="px-3 py-2 text-xs text-stone-400">No sources yet</p>}
        </div>
      )}
    </div>
  )
}
