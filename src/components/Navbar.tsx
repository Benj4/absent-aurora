import { useEffect, useState } from 'react';
import type { User } from '@supabase/auth-js';
import { supabase } from '../lib/supabase';
import { stripBase, withBase } from '../lib/paths';

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activePath, setActivePath] = useState('/');

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

    setActivePath(stripBase(window.location.pathname));

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = withBase('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isActive = (path: string) => activePath === path;

  return (
    <div className="navbar bg-base-100 border-b border-base-200 px-4">
      {/* Brand */}
      <div className="navbar-start">
        <a href={withBase('/')} className="text-lg font-bold tracking-tight">
          Absent Aurora
        </a>
      </div>

      {/* Center nav links */}
      <div className="navbar-center hidden md:flex">
        <ul className="menu menu-horizontal px-1 gap-1">
          <li>
            <a
              href={withBase('/')}
              className={isActive('/') ? 'active' : ''}
            >
              Inicio
            </a>
          </li>
          <li>
            <a
              href={withBase('/postlist')}
              className={isActive('/postlist') ? 'active' : ''}
            >
              Publicaciones
            </a>
          </li>
        </ul>
      </div>

      {/* Right section */}
      <div className="navbar-end">
        {!user ? (
          <a href={withBase('/login')} className="btn btn-primary btn-sm">
            Iniciar sesión
          </a>
        ) : (
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2">
              {/* User icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
              </svg>
              <span className="max-w-[160px] truncate text-sm">{user.email}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-lg border border-base-200"
            >
              <li>
                <a href={withBase(`/user?userId=${user.id}`)}>
                  {/* List/profile icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M7.491 5.992A7.5 7.5 0 0 1 21.5 12a7.5 7.5 0 0 1-14.498 2.724 7.5 7.5 0 0 1 0-5.448ZM3.75 12a8.25 8.25 0 1 1 16.5 0 8.25 8.25 0 0 1-16.5 0Zm9-3.75a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" clipRule="evenodd" />
                  </svg>
                  Mis publicaciones
                </a>
              </li>
              <li>
                <a href={withBase(`/user/reviews?userId=${user.id}`)}>
                  {/* Reviews icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M11.625 16.5a1.875 1.875 0 1 0 0-3.75 1.875 1.875 0 0 0 0 3.75Z" />
                    <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Zm6 16.5c.66 0 1.277-.19 1.797-.518l1.048 1.048a.75.75 0 0 0 1.06-1.06l-1.047-1.048A3.375 3.375 0 1 0 11.625 18Z" clipRule="evenodd" />
                    <path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z" />
                  </svg>
                  Mis reviews
                </a>
              </li>
              <li className="border-t border-base-200 mt-1 pt-1">
                <button
                  onClick={() => void handleLogout()}
                  className="text-error w-full text-left flex items-center gap-2"
                >
                  {/* Logout icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                  Cerrar sesión
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
