'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import type { Option } from '@/lib/dropdown-option-sets'

// A strict single-select (value must come from `options`) with a type-to-filter
// search box instead of a native <select> — built for option lists too long to
// scan by eye (e.g. every Object_ID in Inventory Master), where scrolling a plain
// dropdown is slower than typing a few characters of the ID or name.
export default function SearchableSelect({
  value, onChange, options, placeholder = 'Search…', className, notFoundLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  notFoundLabel?: (v: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)
  const displayValue = open ? query : (selected?.label ?? (value ? notFoundLabel?.(value) ?? value : ''))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = query.trim()
    ? options.filter(o => {
        const q = query.trim().toLowerCase()
        return o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
      })
    : options

  function choose(v: string) {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={displayValue}
          onFocus={() => { setOpen(true); setQuery(''); setHighlight(0) }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0) }}
          onKeyDown={e => {
            if (!open) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) choose(filtered[highlight].value) }
            else if (e.key === 'Escape') { setOpen(false); setQuery('') }
          }}
          placeholder={placeholder}
          className={`${className} pl-7 pr-7`}
        />
        {value && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { onChange(''); setQuery(''); setOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-[#eae4da] rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-stone-400">No matches</div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(o.value)}
                className={`w-full text-left px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  i === highlight ? 'bg-[#F7F3ED] text-[#1B3A2E]' : 'text-stone-700 hover:bg-[#F7F3ED]'
                }`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
