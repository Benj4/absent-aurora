import React from 'react';
import { ConfigProvider, type ThemeConfig } from 'antd';
import { StyleProvider } from '@ant-design/cssinjs';
import esES from 'antd/locale/es_ES';

/**
 * AntdProvider - Proveedor global de Ant Design para Absent Aurora
 * 
 * Proporciona:
 * - ConfigProvider con tema personalizado y localización española
 * - StyleProvider para manejo correcto de estilos en SSR
 * - Tema adaptado a los colores del proyecto (Tailwind variables)
 * 
 * Uso en páginas Astro:
 * ```astro
 * ---
 * import AntdProvider from '../components/AntdProvider';
 * import MiComponente from '../components/MiComponente';
 * ---
 * 
 * <AntdProvider client:only="react">
 *   <MiComponente />
 * </AntdProvider>
 * ```
 */

interface AntdProviderProps {
  children: React.ReactNode;
}

// Tema personalizado para Absent Aurora
const theme: ThemeConfig = {
  token: {
    // Colores primarios del proyecto
    colorPrimary: '#3b82f6', // Tailwind blue-500
    colorSuccess: '#10b981', // Tailwind green-500
    colorWarning: '#f59e0b', // Tailwind amber-500
    colorError: '#ef4444', // Tailwind red-500
    colorInfo: '#06b6d4', // Tailwind cyan-500
    
    // Tipografía - JetBrains Mono
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
    fontSize: 14,
    
    // Bordes y radios
    borderRadius: 6,
    
    // Espaciado
    controlHeight: 36,
  },
  components: {
    Button: {
      controlHeight: 36,
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: 8,
    },
    Input: {
      controlHeight: 36,
    },
  },
};

export default function AntdProvider({ children }: AntdProviderProps) {
  return (
    <StyleProvider hashPriority="high">
      <ConfigProvider
        locale={esES}
        theme={theme}
      >
        {children}
      </ConfigProvider>
    </StyleProvider>
  );
}
