import Sidebar from '@/components/portal/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark portal-layout">
      <Sidebar />
      <main className="portal-main">
        {children}
      </main>
    </div>
  )
}
