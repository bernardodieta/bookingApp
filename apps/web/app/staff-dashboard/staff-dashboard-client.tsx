'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CalendarDays, LogOut, UserCircle } from 'lucide-react';
import { StaffBookingsSection } from './components/staff-bookings-section';
import { StaffCalendarSection } from './components/staff-calendar-section';
import { StaffProfileSection } from './components/staff-profile-section';

const TOKEN_KEY = 'apoint.dashboard.token';
const API_URL_KEY = 'apoint.dashboard.apiUrl';
const ROLE_KEY = 'apoint.dashboard.role';

type ActiveTab = 'bookings' | 'calendar' | 'profile';

const TAB_LABELS: Record<ActiveTab, string> = {
  bookings: 'Mis Citas',
  calendar: 'Sincronización',
  profile: 'Mi Perfil'
};

function getInitialTab(): ActiveTab {
  if (typeof window === 'undefined') return 'bookings';
  const hash = window.location.hash.replace('#', '');
  if (hash === 'bookings' || hash === 'calendar' || hash === 'profile') return hash;
  return 'bookings';
}

export default function StaffDashboardClient() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab);
  const [staffName, setStaffName] = useState('');
  const [staffFullName, setStaffFullName] = useState('');

  function changeTab(tab: ActiveTab) {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
  }

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
    setApiUrl(storedApiUrl ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

    // Fetch user info
    fetch(new URL('/auth/me', storedApiUrl ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').toString(), {
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

    // Fetch staff profile name
    fetch(new URL('/staff/me', storedApiUrl ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').toString(), {
      headers: { Authorization: `Bearer ${storedToken}` }
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data: { fullName?: string } | null) => {
        if (data?.fullName) setStaffFullName(data.fullName);
      })
      .catch(() => {});
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
          <div style={{ display: 'grid', gap: 12, width: 260 }}>
            <div className="skeleton" style={{ height: 32 }} />
            <div className="skeleton" style={{ height: 20, width: '60%' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
              <div className="skeleton" style={{ height: 72 }} />
              <div className="skeleton" style={{ height: 72 }} />
              <div className="skeleton" style={{ height: 72 }} />
            </div>
            <div className="skeleton" style={{ height: 80 }} />
            <div className="skeleton" style={{ height: 80 }} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-layout">
      <aside className="dashboard-sidebar surface staff-hide-mobile">
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
            onClick={() => changeTab('bookings')}
          >
            <CalendarDays size={16} />
            <span>Mis Citas</span>
          </button>

          <button
            type="button"
            className={`sidebar-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => changeTab('calendar')}
          >
            <Calendar size={16} />
            <span>Sincronización</span>
          </button>

          <button
            type="button"
            className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => changeTab('profile')}
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

      <section className="dashboard-main staff-main-mobile">
        <div className="dashboard-content">
          <div style={{ display: activeTab === 'bookings' ? 'block' : 'none' }}>
            <StaffBookingsSection apiUrl={apiUrl} token={token} staffName={staffFullName || staffName} />
          </div>
          <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
            <StaffCalendarSection apiUrl={apiUrl} token={token} />
          </div>
          <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }}>
            <StaffProfileSection apiUrl={apiUrl} token={token} />
          </div>
        </div>
      </section>

      {/* Mobile bottom tab bar */}
      <nav className="staff-bottom-tabs">
        <button
          type="button"
          className={activeTab === 'bookings' ? 'active' : ''}
          onClick={() => changeTab('bookings')}
        >
          <CalendarDays size={18} />
          Citas
        </button>
        <button
          type="button"
          className={activeTab === 'calendar' ? 'active' : ''}
          onClick={() => changeTab('calendar')}
        >
          <Calendar size={18} />
          Sync
        </button>
        <button
          type="button"
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => changeTab('profile')}
        >
          <UserCircle size={18} />
          Perfil
        </button>
        <button
          type="button"
          onClick={handleLogout}
          style={{ color: '#ef4444' }}
        >
          <LogOut size={18} />
          Salir
        </button>
      </nav>
    </main>
  );
}
