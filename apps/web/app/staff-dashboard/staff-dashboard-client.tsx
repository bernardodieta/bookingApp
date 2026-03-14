'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, LogOut, Link as LinkIcon, UserCircle } from 'lucide-react';
import { StaffBookingsSection } from './components/staff-bookings-section';
import { StaffCalendarSection } from './components/staff-calendar-section';
import { StaffProfileSection } from './components/staff-profile-section';

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';
const ROLE_KEY = 'apoint.dashboard.role';

type ActiveTab = 'bookings' | 'calendar' | 'profile';

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
      <main className="dashboard-layout">
        <section className="dashboard-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <p style={{ color: '#64748b' }}>Cargando...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-layout">
      <aside className="dashboard-sidebar surface">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <CalendarDays size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Panel de Staff</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{staffName}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <CalendarDays size={16} />
            <span>Mis Citas</span>
          </button>

          <button
            type="button"
            className={`sidebar-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <LinkIcon size={16} />
            <span>Mi Calendario</span>
          </button>

          <button
            type="button"
            className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <UserCircle size={16} />
            <span>Mi Perfil</span>
          </button>

          <button
            type="button"
            className="sidebar-item"
            onClick={handleLogout}
            style={{ marginTop: 'auto', color: '#ef4444' }}
          >
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar surface">
          <div className="topbar-left">
            <div className="topbar-logo">
              <CalendarDays size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Panel de Staff</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{staffName}</div>
            </div>
          </div>

          <div className="topbar-right">
            <button type="button" onClick={handleLogout} className="btn btn-ghost">
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {activeTab === 'bookings' && <StaffBookingsSection apiUrl={apiUrl} token={token} />}
          {activeTab === 'calendar' && <StaffCalendarSection apiUrl={apiUrl} token={token} />}
          {activeTab === 'profile' && <StaffProfileSection apiUrl={apiUrl} token={token} />}
        </div>
      </section>
    </main>
  );
}
