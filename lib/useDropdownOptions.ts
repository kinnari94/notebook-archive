'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Option } from '@/lib/dropdown-option-sets'

// Fetches the merged (static + Mongo-backed custom) option list for every dropdown
// optionSetKey, and exposes addOption()/deleteOption() to persist changes so they show
// up for every user, everywhere that key is used — not just the current session.
// `customValues` tracks which values in each optionSet are user-added (and therefore
// deletable) as opposed to hardcoded static defaults.
export function useDropdownOptions() {
  const [optionSets, setOptionSets] = useState<Record<string, Option[]>>({})
  const [customValues, setCustomValues] = useState<Record<string, string[]>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/srmd/dropdown-options')
      .then(r => r.json())
      .then(d => {
        setOptionSets(d.optionSets || {})
        setCustomValues(d.custom || {})
      })
      .finally(() => setLoaded(true))
  }, [])

  const addOption = useCallback(async (optionSetKey: string, value: string) => {
    const res = await fetch('/api/srmd/dropdown-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionSetKey, value }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || 'Failed to add option')
    setOptionSets(p => ({ ...p, [optionSetKey]: json.options || p[optionSetKey] || [] }))
    setCustomValues(p => ({ ...p, [optionSetKey]: json.custom || p[optionSetKey] || [] }))
    return (json.options || []) as Option[]
  }, [])

  const deleteOption = useCallback(async (optionSetKey: string, value: string) => {
    const res = await fetch('/api/srmd/dropdown-options', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionSetKey, value }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || 'Failed to delete option')
    setOptionSets(p => ({ ...p, [optionSetKey]: json.options || p[optionSetKey] || [] }))
    setCustomValues(p => ({ ...p, [optionSetKey]: json.custom || [] }))
    return (json.options || []) as Option[]
  }, [])

  return { optionSets, customValues, loaded, addOption, deleteOption }
}
