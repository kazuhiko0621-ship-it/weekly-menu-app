import { useEffect, useState } from 'react'
import CalendarView from './components/CalendarView.jsx'
import PopularMeals from './components/PopularMeals.jsx'
import WishlistScreen from './components/WishlistScreen.jsx'
import WishlistAddScreen from './components/WishlistAddScreen.jsx'
import ShoppingRangeScreen, { defaultRangeFromWeekStart } from './components/ShoppingRangeScreen.jsx'
import ShoppingListScreen from './components/ShoppingListScreen.jsx'
import NavBar from './components/NavBar.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import MealEditScreen from './components/MealEditScreen.jsx'
import { supabase } from './supabaseClient.js'
import { getWeekStart, addDays, formatTwoWeekRange } from './utils/date.js'

export default function App() {
  const [view, setView] = useState('week')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingDay, setEditingDay] = useState(null)
  const [addingWishlistItem, setAddingWishlistItem] = useState(false)
  const [shoppingScreen, setShoppingScreen] = useState(null) // null | 'range' | 'list'
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)
  const currentWeekStart = getWeekStart(new Date())

  function goToCurrentWeek() {
    setWeekStart(currentWeekStart)
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
  if (shoppingScreen === 'range') {
    const { start, end } = defaultRangeFromWeekStart(weekStart)
    return (
      <div className="app-shell">
        <ShoppingRangeScreen
          defaultStart={start}
          defaultEnd={end}
          onBack={() => setShoppingScreen(null)}
          onGenerated={() => setShoppingScreen('list')}
        />
      </div>
    )
  }
  if (shoppingScreen === 'list') {
    return (
      <div className="app-shell">
        <ShoppingListScreen
          onBack={() => setShoppingScreen(null)}
          onRegenerate={() => setShoppingScreen('range')}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
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
            今週に戻る
          </button>
          <button type="button" className="signout-btn" onClick={() => supabase.auth.signOut()}>
            ログアウト
          </button>
        </div>
      </header>

      <main className="app-main">
        {view === 'week' && (
          <CalendarView
            weekStart={weekStart}
            onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
            onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
            onEditDay={setEditingDay}
            refreshKey={refreshKey}
            onOpenShoppingList={() => setShoppingScreen('list')}
          />
        )}
        {view === 'popular' && <PopularMeals onAdded={bumpRefresh} />}
        {view === 'wishlist' && (
          <WishlistScreen onAddNew={() => setAddingWishlistItem(true)} refreshKey={refreshKey} />
        )}
      </main>

      <NavBar view={view} onChange={setView} />
    </div>
  )
}
