import React from 'react';
import { Button, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

/**
 * Simple Ant Design test component to verify styles are loading
 */
export default function AntdSimpleTest() {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
          Test de Estilos Ant Design
        </h1>
        
        <div>
          <Button 
            type="primary" 
            size="large"
            icon={<CheckCircleOutlined />}
            onClick={() => setCount(c => c + 1)}
          >
            Primario (Clicks: {count})
          </Button>
        </div>

        <div>
          <Button type="default" size="large">
            Predeterminado
          </Button>
        </div>

        <div>
          <Button type="dashed" size="large">
            Punteado
          </Button>
        </div>

        <div>
          <Button type="primary" danger size="large">
            Peligro
          </Button>
        </div>

        <div style={{ 
          padding: '16px', 
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            ¿Los botones tienen estilos?
          </p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>✅ Si ves botones azules, verdes, rojos con estilos = Funciona</li>
            <li>❌ Si solo ves texto plano = Faltan estilos</li>
          </ul>
        </div>
      </Space>
    </div>
  );
}
