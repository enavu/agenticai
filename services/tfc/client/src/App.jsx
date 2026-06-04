import { Routes, Route, NavLink } from 'react-router-dom'
import { MoodProvider, MoodToggle } from './components/MoodToggle.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Spending from './pages/Spending.jsx'
import Food from './pages/Food.jsx'

const NAV_LINKS = [
  { to: '/',         label: '🗺️ Trips'    },
  { to: '/spending', label: '💳 Spending'  },
  { to: '/food',     label: '🍔 Food'      },
]

export default function App() {
  return (
    <MoodProvider>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            {/* Logo + nav */}
            <div className="flex items-center gap-6">
              <span className="font-bold text-white text-sm tracking-tight">
                ✈️ Trip Fund Coach
              </span>
              <nav className="flex items-center gap-1">
                {NAV_LINKS.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/'}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-gray-800 text-white font-medium'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Mood toggle */}
            <MoodToggle />
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/spending" element={<Spending />}  />
            <Route path="/food"     element={<Food />}      />
          </Routes>
        </main>
      </div>
    </MoodProvider>
  )
}
