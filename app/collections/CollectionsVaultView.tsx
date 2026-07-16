'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Package, Plus } from 'lucide-react'
import { SRMD_NAV, getSrmdSheet } from '@/lib/srmd-sheets'
import { hasEditAccess, type ViewPermissions } from '@/lib/permissions'
import SrmdSheetView, { type SrmdSheetViewHandle } from './[slug]/SrmdSheetView'
import DashboardView from './dashboard/DashboardView'
import MonthlyReportView from './reports/monthly/MonthlyReportView'
import TreatmentSheetView from './reports/treatment-sheet/TreatmentSheetView'
import HandoverChecklistView from './reports/handover/HandoverChecklistView'

const SHEET_SLUGS = new Set([
  'inventory', 'condition', 'risk-priority', 'location-storage',
  'photo-log', 'environment', 'treatments', 'change-log',
])

const TABS = SRMD_NAV.filter(t => t.slug !== 'readme')

export default function CollectionsVaultView() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const sheetViewRef = useRef<SrmdSheetViewHandle>(null)
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollFades = useCallback(() => {
    const el = tabScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateScrollFades()
    window.addEventListener('resize', updateScrollFades)
    return () => window.removeEventListener('resize', updateScrollFades)
  }, [updateScrollFades])

  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const permissions = (session?.user as { permissions?: ViewPermissions | null } | undefined)?.permissions
  const canEdit = hasEditAccess(role, permissions, 'collections')

  const canAddOnActiveTab = canEdit && SHEET_SLUGS.has(activeTab)
  const activeConfig = SHEET_SLUGS.has(activeTab) ? getSrmdSheet(activeTab) : undefined

  function renderActive() {
    if (activeTab === 'dashboard') return <DashboardView />
    if (activeTab === 'reports/monthly') return <MonthlyReportView />
    if (activeTab === 'reports/treatment-sheet') return <TreatmentSheetView />
    if (activeTab === 'reports/handover') return <HandoverChecklistView />
    if (SHEET_SLUGS.has(activeTab)) return <SrmdSheetView slug={activeTab} ref={sheetViewRef} />
    return null
  }

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#1B3A2E] font-sans">
      {/* PROFESSIONAL HEADER SECTION */}
      <header className="bg-white border-b border-[#E8E3DB] sticky top-0 z-40">
        <div className="px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#1B3A2E] rounded-xl flex items-center justify-center shadow-inner">
              <Package className="w-5 h-5 text-[#F7F3ED]" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold tracking-tight text-[#1B3A2E]">
                Collections Vault
              </h1>
              <p className="text-[10px] font-bold text-[#1B3A2E]/40 uppercase tracking-[0.2em] mt-0.5">
                Institutional Archive Management
              </p>
            </div>
          </div>

          {canAddOnActiveTab && (
            <button
              onClick={() => sheetViewRef.current?.openAdd()}
              className="px-4 py-2.5 bg-[#1B3A2E] hover:bg-[#2D5C45] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add {activeConfig?.label ?? 'Entry'}
            </button>
          )}
        </div>

        {/* TAB NAVIGATION — numbered segmented pill group, permanently rounded window */}
        <div className="px-8 pb-4">
          <div className="relative rounded-xl overflow-hidden bg-[#F7F3ED]">
            <div
              ref={tabScrollRef}
              onScroll={updateScrollFades}
              className="overflow-x-auto no-scrollbar"
            >
              <div className="inline-flex items-center gap-1 p-1 min-w-max">
                {TABS.map((tab, idx) => {
                  const active = activeTab === tab.slug
                  return (
                    <button
                      key={tab.slug}
                      onClick={() => setActiveTab(tab.slug)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                        active ? 'bg-[#1B3A2E] text-white shadow-sm' : 'text-[#1B3A2E]/50 hover:text-[#1B3A2E]'
                      }`}
                    >
                      <span className={`font-mono text-[10px] ${active ? 'text-white/60' : 'text-[#1B3A2E]/30'}`}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {tab.label}
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
            {canScrollLeft && (
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-[#F7F3ED] to-transparent" />
            )}
            {canScrollRight && (
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-[#F7F3ED] to-transparent" />
            )}
          </div>
        </div>
      </header>

      {/* CONTENT AREA */}
      <main className="max-w-[2000px]">
       

        {/* Content Container */}
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-500">
           {renderActive()}
        </div>
      </main>
    </div>
  )
}