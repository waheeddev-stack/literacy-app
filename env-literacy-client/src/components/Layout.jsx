import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import ChatWidget from './ChatWidget.jsx';

const NAV = {
  student: [['/', 'Home', true], ['/quizzes', 'Quizzes'], ['/checkin', 'Check-in'], ['/practice', 'Practice'], ['/challenges', 'Challenges'], ['/account', 'Account']],
  teacher: [['/classes', 'Classes'], ['/quizzes', 'Quizzes'], ['/announcements', 'Announcements'], ['/account', 'Account']],
  inst_admin: [['/institution', 'Dashboard'], ['/classes', 'Classes'], ['/quizzes', 'Quizzes'], ['/audit', 'Campus audit'], ['/people', 'People'], ['/announcements', 'Announcements'], ['/account', 'Account']],
  regional_admin: [['/region', 'Regional'], ['/questions', 'Question bank'], ['/account', 'Account']],
  super_admin: [['/region', 'Regional'], ['/institutions', 'Institutions'], ['/people', 'People'], ['/questions', 'Question bank'], ['/settings', 'Settings'], ['/activity', 'Activity'], ['/account', 'Account']],
};
const ROLE_LABEL = { student: 'Student', teacher: 'Teacher', inst_admin: 'Institution admin', regional_admin: 'Regional admin', super_admin: 'Super admin' };
const ADMIN = ['inst_admin', 'regional_admin', 'super_admin'];

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== 'light');
  const flip = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; setDark(!dark);
    try { localStorage.setItem('elp_theme', next); } catch { /* ignore */ }
  };
  return <button className="btn text" onClick={flip} aria-pressed={dark}>{dark ? 'Light mode' : 'Dark mode'}</button>;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const links = NAV[user.role] || [];
  const who = (
    <span className="small muted">{user.name} · {ROLE_LABEL[user.role]}{user.institution ? ` · ${user.institution.name}` : ''}</span>
  );

  // Left sidebar only for admin roles (PRD §11); students and teachers get a simple top bar.
  if (ADMIN.includes(user.role)) {
    return (
      <div className="with-side">
        <aside className="side">
          <strong className="brand">Env Literacy</strong>
          {links.map(([to, label]) => <NavLink key={to} to={to} className="link">{label}</NavLink>)}
          <div className="foot">
            <div className="xs muted" style={{ marginBottom: 8 }}>{who}</div>
            <ThemeToggle /><button className="btn text" onClick={logout}>Log out</button>
          </div>
        </aside>
        <main className="main"><Outlet /></main>
        <ChatWidget />
      </div>
    );
  }
  return (
    <div className="shell">
      <header className="topbar"><div className="topbar-in">
        <strong className="brand">Env Literacy</strong>
        <nav className="nav" aria-label="Main">{links.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}</nav>
        <ThemeToggle /><button className="btn text" onClick={logout}>Log out</button>
      </div></header>
      <main className="main"><div className="xs muted" style={{ marginBottom: 'var(--s2)' }}>{who}</div><Outlet /></main>
      <ChatWidget />
    </div>
  );
}
