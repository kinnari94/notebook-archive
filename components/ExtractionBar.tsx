'use client'
import { useExtraction } from './ExtractionContext'
import { RefreshCw, ChevronUp, X } from 'lucide-react'

export default function ExtractionBar() {
  const { running, logs, progress, minimized, restore, clear } = useExtraction()

  if (!running && logs.length === 0) return null
  if (!minimized) return null

  const lastLog = logs[logs.length - 1]
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-[#1c1917] text-white rounded-2xl shadow-xl border border-stone-700 w-80 cursor-pointer"
      onClick={restore}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {running
          ? <RefreshCw className="w-4 h-4 text-green-400 animate-spin shrink-0" />
          : <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">
            {running ? 'Extracting…' : 'Extraction complete'}
            {pct !== null && running && <span className="ml-2 text-green-400 font-mono">{pct}%</span>}
          </p>
          {lastLog && (
            <p className="text-[10px] text-stone-400 truncate mt-0.5">{lastLog.msg}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={e => { e.stopPropagation(); restore() }}
            className="p-1 hover:bg-stone-700 rounded-lg transition-colors" title="Expand">
            <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
          </button>
          {!running && (
            <button onClick={e => { e.stopPropagation(); clear() }}
              className="p-1 hover:bg-stone-700 rounded-lg transition-colors" title="Dismiss">
              <X className="w-3.5 h-3.5 text-stone-400" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {progress && (
        <div className="h-1 bg-stone-700 rounded-b-2xl overflow-hidden">
          <div className="h-full bg-green-400 transition-all duration-300"
            style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
      )}
    </div>
  )
}
