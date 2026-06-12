import { useState, useCallback, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import CommandPalette from './CommandPalette'
import QuickLogDialog from './QuickLogDialog'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [quickLogOpen, setQuickLogOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Global shortcuts: Cmd/Ctrl+K → search palette, Cmd/Ctrl+Shift+L → quick log
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setQuickLogOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      {/* Spacer for fixed sidebar - only on lg+ */}
      <div className="hidden lg:block w-[220px] shrink-0" />

      {/* Main content area */}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col">
        <TopBar onToggleSidebar={toggleSidebar} onOpenSearch={() => setPaletteOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden pb-20 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav onMoreClick={toggleSidebar} />

      {/* Global command palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onLogTime={() => { setPaletteOpen(false); setQuickLogOpen(true) }}
      />

      {/* Global quick-log dialog */}
      <QuickLogDialog open={quickLogOpen} onOpenChange={setQuickLogOpen} />
    </div>
  )
}
