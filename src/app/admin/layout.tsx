import AdminSidebar from '@/components/admin/AdminSidebar'

export const metadata = {
  title: 'Gzad Admin',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050505', fontFamily: "'Inter', sans-serif" }}>
      <AdminSidebar />
      <main style={{ flex: '1 1 auto', padding: '40px', marginLeft: 260, minHeight: '100vh', boxSizing: 'border-box' as const }}>
        {children}
      </main>
    </div>
  )
}
