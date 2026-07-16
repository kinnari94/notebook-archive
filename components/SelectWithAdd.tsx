'use client'
import React, { useState } from 'react'
import { Check, X, Loader2, Trash2 } from 'lucide-react'
import type { Option } from '@/lib/dropdown-option-sets'

const ADD_NEW = '__add_new__'

// A <select> that lets an editor type a brand-new option inline, persist it to
// MongoDB (via onAddOption), and immediately select it — so the value shows up for
// every user, everywhere else this optionSetKey is used, from then on. If the
// currently selected value is itself a user-added custom option (as opposed to a
// hardcoded static default), a trash icon lets the editor delete it everywhere too.
export default function SelectWithAdd({
  value, onChange, options, canAdd, onAddOption, customValues, onDeleteOption, className, placeholder = '—',
}: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  canAdd: boolean
  onAddOption: (value: string) => Promise<unknown>
  customValues?: string[]
  onDeleteOption?: (value: string) => Promise<unknown>
  className?: string
  placeholder?: string
}) {
  const [adding, setAdding] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function confirmAdd() {
    const v = newValue.trim()
    if (!v) { setAdding(false); return }
    setSaving(true)
    try {
      await onAddOption(v)
      onChange(v)
      setAdding(false)
      setNewValue('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add option')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDeleteOption || !value) return
    if (!confirm(`Delete the option "${value}"? This removes it everywhere it's used.`)) return
    setDeleting(true)
    try {
      await onDeleteOption(value)
      onChange('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete option')
    } finally {
      setDeleting(false)
    }
  }

  if (adding) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirmAdd() }
            if (e.key === 'Escape') setAdding(false)
          }}
          placeholder="New option…"
          disabled={saving}
          className={className}
        />
        <button type="button" onClick={confirmAdd} disabled={saving} className="p-1.5 rounded-lg bg-[#1B3A2E] text-white shrink-0 disabled:opacity-50 cursor-pointer">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={() => setAdding(false)} disabled={saving} className="p-1.5 rounded-lg bg-stone-100 text-stone-500 shrink-0 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  const isDeletableCustom = !!value && !!onDeleteOption && !!customValues?.some(v => v.toLowerCase() === value.toLowerCase())

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={e => {
          if (e.target.value === ADD_NEW) { setAdding(true); setNewValue('') }
          else onChange(e.target.value)
        }}
        className={`${className} cursor-pointer`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        {canAdd && <option value={ADD_NEW}>+ Add new option…</option>}
      </select>
      {canAdd && isDeletableCustom && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          title={`Delete "${value}"`}
          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 shrink-0 disabled:opacity-50 cursor-pointer"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  )
}
