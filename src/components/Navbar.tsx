import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/auth-js';
import type { MenuProps } from 'antd';
import { Layout, Menu } from 'antd';
import { LogoutOutlined, ProfileOutlined, UserOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';

const { Header } = Layout;

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeKey, setActiveKey] = useState('inicio');

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

    const pathname = window.location.pathname;
    if (pathname === '/') setActiveKey('inicio');
    else if (pathname === '/postlist') setActiveKey('publicaciones');
    else if (pathname === '/antd-demo' || pathname === '/antd-test') setActiveKey('demo');

    return () => {
      mounted = false;
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

  const navItems = useMemo<MenuProps['items']>(
    () => {
      const baseItems: NonNullable<MenuProps['items']> = [
        { key: 'inicio', label: <a href="/">Inicio</a> },
        { key: 'publicaciones', label: <a href="/postlist">Publicaciones</a> },
        { key: 'demo', label: <a href="/antd-demo">Demo Ant Design</a> },
        {
          key: 'spacer',
          label: '',
          disabled: true,
          style: { marginInlineStart: 'auto', cursor: 'default' },
        },
      ];

      if (!user) {
        return [...baseItems, { key: 'iniciar-sesion', label: <a href="/login">Iniciar sesion</a> }];
      }

      return [
        ...baseItems,
        {
          key: 'perfil',
          label: user.email ?? 'Usuario',
          children: [
            {
              key: 'mis-publicaciones',
              icon: <ProfileOutlined />,
              label: <a href={`/user?userId=${user.id}`}>Mis publicaciones</a>,
            },
            {
              key: 'mis-reviews',
              icon: <UserOutlined />,
              label: <a href={`/user/reviews?userId=${user.id}`}>Mis reviews</a>,
            },
            { type: 'divider' },
            {
              key: 'cerrar-sesion',
              icon: <LogoutOutlined />,
              label: 'Cerrar sesion',
              danger: true,
            },
          ],
        },
      ];
    },
    [user],
  );

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'cerrar-sesion') {
      void handleLogout();
    }
  };

  return (
    <Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        paddingInline: 24,
      }}
    >
      <div className="demo-logo" />

      <Menu
        theme="light"
        mode="horizontal"
        selectedKeys={[activeKey]}
        items={navItems}
        onClick={onMenuClick}
        style={{ flex: 1, minWidth: 0 }}
      />

      <style>{`
        .demo-logo {
          width: 120px;
          min-width: 120px;
          height: 32px;
          border-radius: 6px;
          /* background: rgba(255, 255, 255, 0.2); */
        }

        @media (max-width: 900px) {
          .demo-logo {
            width: 72px;
            min-width: 72px;
          }
        }
      `}</style>
    </Header>
  );
};

export default Navbar;
