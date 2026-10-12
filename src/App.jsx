import { useEffect, useState } from 'react'
import CalendarView from './components/CalendarView.jsx'
import IdeasScreen from './components/IdeasScreen.jsx'
import BentoScreen from './components/BentoScreen.jsx'
import WishlistAddScreen from './components/WishlistAddScreen.jsx'
import ShoppingRangeScreen from './components/ShoppingRangeScreen.jsx'
import ShoppingListScreen from './components/ShoppingListScreen.jsx'
import NavBar from './components/NavBar.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import MealEditScreen from './components/MealEditScreen.jsx'
import { supabase } from './supabaseClient.js'
import { getWeekStart, addDays, formatTwoWeekRange } from './utils/date.js'

export default function App() {
  const [view, setView] = useState('week') // 'week' | 'bento' | 'shopping' | 'ideas'
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingDay, setEditingDay] = useState(null)
  const [addingWishlistItem, setAddingWishlistItem] = useState(false)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [shoppingSummary, setShoppingSummary] = useState(null)
  const [bentoSummary, setBentoSummary] = useState(null)
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  function goToCurrentWeek() {
    setWeekStart(getWeekStart(new Date()))
    setView('week')
    setEditingDay(null)
  }

  if (session === undefined) {
    return <div className="app-shell"><p className="loading-text">読み込み中…</p></div>
  }
  if (!session) {
    return <div className="app-shell"><LoginScreen /></div>
  }
  if (editingDay) {
    return (
      <div className="app-shell">
        <MealEditScreen day={editingDay} onBack={() => { setEditingDay(null); bumpRefresh() }} />
      </div>
    )
  }
  if (addingWishlistItem) {
    return (
      <div className="app-shell">
        <WishlistAddScreen onBack={() => setAddingWishlistItem(false)} onAdded={bumpRefresh} />
      </div>
    )
  }
  if (rangeOpen) {
    return (
      <div className="app-shell">
        <ShoppingRangeScreen
          onBack={() => setRangeOpen(false)}
          onGenerated={() => { setRangeOpen(false); bumpRefresh() }}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {view === 'week' && (
        <header className="app-header app-header-slim">
          <div className="app-header-date-nav">
            <button type="button" className="week-nav-btn" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label="前の週">
              ‹
            </button>
            <span className="app-header-date">{formatTwoWeekRange(weekStart)}</span>
            <button type="button" className="week-nav-btn" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label="次の週">
              ›
            </button>
          </div>
          <div className="app-header-actions">
            <button type="button" className="header-btn" onClick={goToCurrentWeek}>
              今週
            </button>
            <button type="button" className="signout-btn" onClick={() => supabase.auth.signOut()}>
              ログアウト
            </button>
          </div>
        </header>
      )}

      {view !== 'week' && (
        <header className="app-header app-header-slim">
          <div className="app-header-titlebox">
            <span className="app-header-date">
              {view === 'shopping'
                ? '買い物リスト'
                : view === 'bento'
                  ? '弁当在庫管理'
                  : '献立アイディア'}
            </span>
            {view === 'shopping' && shoppingSummary && (
              <span className="app-header-sub">
                {shoppingSummary.range ? `${shoppingSummary.range}・` : ''}
                残り{shoppingSummary.remaining}品
              </span>
            )}
            {view === 'bento' && bentoSummary && (
              <span className="app-header-sub">
                在庫 {bentoSummary.total}食 / {bentoSummary.lots}ロット
              </span>
            )}
          </div>
          <button type="button" className="signout-btn" onClick={() => supabase.auth.signOut()}>
            ログアウト
          </button>
        </header>
      )}

      <main className="app-main">
        {view === 'week' && (
          <CalendarView
            weekStart={weekStart}
            onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
            onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
            onEditDay={setEditingDay}
            refreshKey={refreshKey}
          />
        )}
        {view === 'shopping' && (
          <ShoppingListScreen
            key={refreshKey}
            onRegenerate={() => setRangeOpen(true)}
            onSummaryChange={setShoppingSummary}
          />
        )}
        {view === 'bento' && <BentoScreen onSummaryChange={setBentoSummary} />}
        {view === 'ideas' && (
          <IdeasScreen
            onAddWishlistItem={() => setAddingWishlistItem(true)}
            onAdded={bumpRefresh}
            refreshKey={refreshKey}
          />
        )}
      </main>

      <NavBar view={view} onChange={setView} />
    </div>
  )
}
