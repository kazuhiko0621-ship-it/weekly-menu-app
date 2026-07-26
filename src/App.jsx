import { useEffect, useState } from 'react'
import WeekView from './components/WeekView.jsx'
import PopularMeals from './components/PopularMeals.jsx'
import NavBar from './components/NavBar.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import MealEditScreen from './components/MealEditScreen.jsx'
import { supabase } from './supabaseClient.js'
import { getWeekStart, addDays } from './utils/date.js'

export default function App() {
  const [view, setView] = useState('week')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingDay, setEditingDay] = useState(null) // { date, dateKey, dowLabel } | null
  // undefined = 確認中, null = 未ログイン, object = ログイン済みセッション
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
    return (
      <div className="app-shell">
        <p className="loading-text">読み込み中…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app-shell">
        <LoginScreen />
      </div>
    )
  }

  if (editingDay) {
    return (
      <div className="app-shell">
        <MealEditScreen
          day={editingDay}
          onBack={() => setEditingDay(null)}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header app-header-slim">
        <h1>週間献立</h1>
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
          <WeekView
            weekStart={weekStart}
            onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
            onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
            onEditDay={setEditingDay}
            refreshKey={refreshKey}
          />
        )}
        {view === 'popular' && <PopularMeals weekStart={weekStart} onAdded={bumpRefresh} />}
      </main>

      <NavBar view={view} onChange={setView} />
    </div>
  )
}
