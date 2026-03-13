'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, LogOut, Link as LinkIcon } from 'lucide-react';
import { StaffBookingsSection } from './components/staff-bookings-section';
import { StaffCalendarSection } from './components/staff-calendar-section';

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';
const ROLE_KEY = 'apoint.dashboard.role';

type ActiveTab = 'bookings' | 'calendar';

export default function StaffDashboardClient() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('bookings');
  const [staffName, setStaffName] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedApiUrl = localStorage.getItem(API_URL_KEY);
    const storedRole = localStorage.getItem(ROLE_KEY);

    if (!storedToken) {
      router.replace('/login');
      return;
    }

    if (storedRole !== 'staff') {
      router.replace('/dashboard');
      return;
    }

    setToken(storedToken);
    setApiUrl(storedApiUrl ?? 'http://localhost:3001');

    // Fetch user info
    fetch(new URL('/auth/me', storedApiUrl ?? 'http://localhost:3001').toString(), {
      headers: { Authorization: `Bearer ${storedToken}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token inválido');
        return res.json();
      })
      .then((data: { email?: string }) => {
        setStaffName(data.email ?? 'Staff');
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ROLE_KEY);
        router.replace('/login');
      });
  }, [router]);

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    router.replace('/login');
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b' }}>Cargando...</p>
      </div>
    );
  }

  const tabs: Array<{ key: ActiveTab; label: string; icon: React.ReactNode }> = [
    { key: 'bookings', label: 'Mis Citas', icon: <CalendarDays size={16} /> },
    { key: 'calendar', label: 'Mi Calendario', icon: <LinkIcon size={16} /> }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f6f8fc)' }}>
      {/* Header */}
      <header
        style={{
          background: 'var(--surface, #fff)',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--primary, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}
          >
            <CalendarDays size={18} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Panel de Staff</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{staffName}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </header>

      {/* Tab bar */}
      <nav
        style={{
          background: 'var(--surface, #fff)',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          padding: '0 24px',
          display: 'flex',
          gap: 4
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--primary, #2563eb)' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
              transition: 'all 0.15s'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        {activeTab === 'bookings' && <StaffBookingsSection apiUrl={apiUrl} token={token} />}
        {activeTab === 'calendar' && <StaffCalendarSection apiUrl={apiUrl} token={token} />}
      </main>
    </div>
  );
}
