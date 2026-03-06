import { useEffect, useState, useRef } from 'react';
import type { User } from '@supabase/auth-js';
import { supabase } from '../lib/supabase';

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchUser() {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) setUser(data?.user ?? null);
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    }

    fetchUser();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });
    const subscription = (data as any)?.subscription;

    // Click outside handler to close the dropdown
    const handleClickOutside = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (menuOpen && menuRef.current && buttonRef.current) {
        if (!menuRef.current.contains(target) && !buttonRef.current.contains(target)) {
          setMenuOpen(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      mounted = false;
      document.removeEventListener('click', handleClickOutside);
      subscription?.unsubscribe?.();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          {/* Logo/Brand Section */}
          <div className="navbar-brand">
            <a href="/" className="brand-link">Absent Aurora</a>
          </div>

          {/* Navigation Links */}
          <div className="navbar-links">
            <a href="/" className="nav-link">Inicio</a>
            <a href="/postlist" className="nav-link">Publicaciones</a>
            <a href="/antd-demo" className="nav-link">Demo Ant Design</a>
            {!user && (
              <a href="/login" className="nav-link" id="login-link">Iniciar sesión</a>
            )}
          </div>

          {/* Profile Menu (Right Side) */}
          <div className="navbar-profile">
            {!user && (
              <a href="/login" className="login-button" id="login-button">Iniciar sesión</a>
            )}

            {user && (
              <div className="profile-menu" id="profile-menu" style={{ display: 'block' }}>
                <button
                  className="profile-button"
                  id="profileButton"
                  ref={buttonRef as any}
                  onClick={() => setMenuOpen((s) => !s)}
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="profile-icon"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>

                <div
                  className={"dropdown-menu" + (menuOpen ? ' active' : '')}
                  id="dropdownMenu"
                  ref={menuRef as any}
                >
                  <div className="dropdown-item user-email" id="user-email">{user.email}</div>
                  <hr className="dropdown-divider" />

                  <a href={`/user?userId=${user.id}`} className="dropdown-item">Mis publicaciones</a>

                  <a href={`/user/reviews?userId=${user.id}`} className="dropdown-item">Mis reviews</a>

                  <hr className="dropdown-divider" />
                  <button id="logoutBtn" className="dropdown-item logout-btn" onClick={handleLogout}>Cerrar sesión</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <style>
        {`
        .navbar {
          background-color: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .navbar-container {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.5rem;
        }

        .navbar-brand {
          flex-shrink: 0;
        }

        .brand-link {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1f2937;
          text-decoration: none;
          transition: color 0.2s;
        }

        .brand-link:hover { color: #3b82f6; }

        .navbar-links { display: flex; gap: 2rem; align-items: center; flex-grow: 1; justify-content: center; }

        .nav-link {
          color: #4b5563;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
          position: relative;
        }

        .nav-link:hover { color: #3b82f6; }
        .nav-link::after { content: ""; position: absolute; bottom: -0.5rem; left: 0; width: 0; height: 2px; background-color: #3b82f6; transition: width 0.2s; }
        .nav-link:hover::after { width: 100%; }

        .navbar-profile { flex-shrink: 0; }

        .profile-menu { position: relative; }

        .profile-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          background-color: #f3f4f6;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .profile-button:hover { background-color: #e5e7eb; }
        .profile-icon { width: 1.5rem; height: 1.5rem; color: #4b5563; }

        .dropdown-menu {
          position: absolute;
          right: 0;
          margin-top: 0.5rem;
          width: 12rem;
          background-color: #ffffff;
          border-radius: 0.5rem;
          box-shadow:
            0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s;
        }

        .dropdown-menu.active { opacity: 1; visibility: visible; transform: translateY(0); }

        .dropdown-item {
          display: block;
          padding: 0.75rem 1rem;
          color: #374151;
          text-decoration: none;
          transition: background-color 0.2s;
          font-size: 0.875rem;
          width: 100%;
          text-align: left;
          border: none;
          background: none;
          cursor: pointer;
          font-family: inherit;
        }

        .dropdown-item.user-email { font-weight: 600; color: #1f2937; cursor: default; font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; }
        .dropdown-item.user-email:hover { background-color: transparent; }
        .dropdown-item.logout-btn { color: #dc2626; }
        .dropdown-item.logout-btn:hover { background-color: #fee2e2; }
        .dropdown-item:first-child { border-radius: 0.5rem 0.5rem 0 0; }
        .dropdown-item:last-child { border-radius: 0 0 0.5rem 0.5rem; }
        .dropdown-item:hover { background-color: #f3f4f6; }
        .dropdown-divider { margin: 0.25rem 0; border: none; border-top: 1px solid #e5e7eb; }

        .login-button { padding: 0.5rem 1rem; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 0.375rem; font-weight: 500; font-size: 0.875rem; transition: background-color 0.2s; }
        .login-button:hover { background-color: #2563eb; }

        @media (max-width: 768px) {
          .navbar-links { gap: 1rem; }
          .nav-link { font-size: 0.875rem; }
          .navbar-container { padding: 0.75rem 1rem; }
        }
        `}
      </style>
    </>
  );
};

export default Navbar;
