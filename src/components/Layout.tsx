import { Outlet } from 'react-router-dom'
import { Header } from './layout/Header'
import { Sidebar } from './layout/Sidebar'

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}