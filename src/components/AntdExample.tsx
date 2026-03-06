import React, { useState } from 'react';
import { 
  Button, 
  Card, 
  Space, 
  Typography, 
  Divider, 
  Input,
  DatePicker,
  Select,
  Alert,
  Tag,
  Statistic,
  Row,
  Col,
  notification,
  message,
  Badge,
  Avatar,
  Steps,
  Table
} from 'antd';
import { 
  UserOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  SyncOutlined,
  RocketOutlined,
  HeartOutlined,
  StarOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface TablaIndicador {
  key: string;
  indicador: string;
  frecuencia: 'Anual' | 'Mensual' | 'Trimestral';
  estado: 'Aprobado' | 'Pendiente' | 'Rechazado';
  ultimoValor: number;
  fuente: string;
}

/**
 * Example component demonstrating Ant Design usage in the Absent Aurora project
 * 
 * This component showcases:
 * - Basic Ant Design components (Button, Card, Typography)
 * - Form components (Input, Select, DatePicker)
 * - Data display (Statistic, Tag, Badge, Avatar)
 * - Feedback components (Alert, notification, message)
 * - Spanish locale support
 * - SSR-compatible implementation
 * - Interactive state management
 * 
 * Usage in Astro pages:
 * ```astro
 * ---
 * import AntdProvider from '../components/AntdProvider';
 * import AntdExample from '../components/AntdExample';
 * ---
 * 
 * <AntdProvider client:only="react">
 *   <AntdExample />
 * </AntdProvider>
 * ```
 */
export default function AntdExample() {
  const [inputValue, setInputValue] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [likeCount, setLikeCount] = useState(42);
  
  const showNotification = () => {
    notification.success({
      message: '¡Éxito!',
      description: 'La notificación se ha mostrado correctamente.',
      placement: 'topRight',
    });
  };

  const showMessage = () => {
    message.info('Este es un mensaje informativo');
  };

  const handleLike = () => {
    setLikeCount(prev => prev + 1);
    message.success('¡Te gusta este ejemplo!');
  };

  const columnasTabla = [
    {
      title: 'Indicador',
      dataIndex: 'indicador',
      key: 'indicador',
      sorter: (a: TablaIndicador, b: TablaIndicador) => a.indicador.localeCompare(b.indicador),
      render: (texto: string) => <Text strong>{texto}</Text>,
    },
    {
      title: 'Frecuencia',
      dataIndex: 'frecuencia',
      key: 'frecuencia',
      filters: [
        { text: 'Anual', value: 'Anual' },
        { text: 'Mensual', value: 'Mensual' },
        { text: 'Trimestral', value: 'Trimestral' },
      ],
      onFilter: (value: boolean | React.Key, record: TablaIndicador) => record.frecuencia === value,
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      filters: [
        { text: 'Aprobado', value: 'Aprobado' },
        { text: 'Pendiente', value: 'Pendiente' },
        { text: 'Rechazado', value: 'Rechazado' },
      ],
      onFilter: (value: boolean | React.Key, record: TablaIndicador) => record.estado === value,
      render: (estado: TablaIndicador['estado']) => {
        if (estado === 'Aprobado') {
          return <Tag color="green">Aprobado</Tag>;
        }

        if (estado === 'Pendiente') {
          return <Tag color="orange">Pendiente</Tag>;
        }

        return <Tag color="red">Rechazado</Tag>;
      },
    },
    {
      title: 'Último Valor',
      dataIndex: 'ultimoValor',
      key: 'ultimoValor',
      align: 'right' as const,
      sorter: (a: TablaIndicador, b: TablaIndicador) => a.ultimoValor - b.ultimoValor,
      render: (valor: number) => valor.toLocaleString('es-ES'),
    },
    {
      title: 'Fuente',
      dataIndex: 'fuente',
      key: 'fuente',
      ellipsis: true,
    },
  ];

  const datosTabla: TablaIndicador[] = [
    {
      key: '1',
      indicador: 'PIB per cápita',
      frecuencia: 'Anual',
      estado: 'Aprobado',
      ultimoValor: 15234.56,
      fuente: 'Banco Central',
    },
    {
      key: '2',
      indicador: 'Inflación interanual',
      frecuencia: 'Mensual',
      estado: 'Pendiente',
      ultimoValor: 4.12,
      fuente: 'Instituto Nacional de Estadística',
    },
    {
      key: '3',
      indicador: 'Tasa de desempleo',
      frecuencia: 'Trimestral',
      estado: 'Aprobado',
      ultimoValor: 7.85,
      fuente: 'Ministerio de Trabajo',
    },
    {
      key: '4',
      indicador: 'Índice de producción industrial',
      frecuencia: 'Mensual',
      estado: 'Rechazado',
      ultimoValor: 98.33,
      fuente: 'Observatorio Económico',
    },
    {
      key: '5',
      indicador: 'Exportaciones totales',
      frecuencia: 'Anual',
      estado: 'Aprobado',
      ultimoValor: 45800999.11,
      fuente: 'Aduanas Nacionales',
    },
  ];

  return (
    <div>
      {/* Header Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Posts Aprobados"
              value={1234}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pendientes"
              value={56}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="En Proceso"
              value={12}
              prefix={<SyncOutlined spin />}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Me gusta"
              value={likeCount}
              prefix={<HeartOutlined />}
              suffix={
                <Button 
                  type="link" 
                  icon={<HeartOutlined />} 
                  onClick={handleLike}
                  style={{ padding: 0 }}
                />
              }
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content */}
      <Card>
        <Title level={2}>
          <RocketOutlined style={{ marginRight: '8px' }} />
          Ejemplo Completo de Ant Design
        </Title>
        <Paragraph>
          Este componente demuestra la integración de Ant Design con soporte SSR en Astro,
          incluyendo localización española y tema personalizado.
        </Paragraph>

        <Alert
          message="Integración Exitosa"
          description="Ant Design está funcionando correctamente con Astro SSR. Todos los componentes están localizados en español."
          type="success"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />

        <Divider>Formularios</Divider>
        
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>Campo de Texto:</Text>
            <Input
              placeholder="Escribe algo aquí..."
              prefix={<UserOutlined />}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{ marginTop: '8px' }}
            />
            {inputValue && (
              <Text type="secondary" style={{ marginTop: '4px', display: 'block' }}>
                Has escrito: {inputValue}
              </Text>
            )}
          </div>

          <div>
            <Text strong>Área de Texto:</Text>
            <TextArea
              rows={4}
              placeholder="Escribe un texto más largo..."
              maxLength={100}
              showCount
              style={{ marginTop: '8px' }}
            />
          </div>

          <div>
            <Text strong>Selector:</Text>
            <Select
              defaultValue="opcion1"
              style={{ width: '100%', marginTop: '8px' }}
              options={[
                { value: 'opcion1', label: 'Opción 1' },
                { value: 'opcion2', label: 'Opción 2' },
                { value: 'opcion3', label: 'Opción 3' },
              ]}
            />
          </div>

          <div>
            <Text strong>Selector de Fecha:</Text>
            <DatePicker 
              placeholder="Selecciona una fecha"
              style={{ width: '100%', marginTop: '8px' }}
            />
          </div>
        </Space>

        <Divider>Botones</Divider>
        
        <Space wrap>
          <Button type="primary" icon={<CheckCircleOutlined />}>
            Primario
          </Button>
          <Button>Predeterminado</Button>
          <Button type="dashed">Punteado</Button>
          <Button type="link">Enlace</Button>
          <Button danger>Peligro</Button>
          <Button type="primary" loading>
            Cargando
          </Button>
        </Space>

        <Divider>Retroalimentación</Divider>
        
        <Space wrap>
          <Button onClick={showNotification}>
            Mostrar Notificación
          </Button>
          <Button onClick={showMessage}>
            Mostrar Mensaje
          </Button>
        </Space>

        <Divider>Etiquetas y Badges</Divider>
        
        <Space wrap>
          <Tag color="blue">Azul</Tag>
          <Tag color="green">Verde</Tag>
          <Tag color="red">Rojo</Tag>
          <Tag color="orange">Naranja</Tag>
          <Badge count={5}>
            <Avatar shape="square" icon={<UserOutlined />} />
          </Badge>
          <Badge dot>
            <Avatar shape="square" icon={<UserOutlined />} />
          </Badge>
          <Tag icon={<StarOutlined />} color="gold">
            Destacado
          </Tag>
        </Space>

        <Divider>Pasos</Divider>
        
        <Steps
          current={currentStep}
          items={[
            {
              title: 'Inicio',
              description: 'Configuración inicial',
            },
            {
              title: 'En Progreso',
              description: 'Procesando datos',
            },
            {
              title: 'Finalizado',
              description: 'Proceso completado',
            },
          ]}
          style={{ marginBottom: '16px' }}
        />
        <Space>
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>
              Anterior
            </Button>
          )}
          {currentStep < 2 && (
            <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
              Siguiente
            </Button>
          )}
          {currentStep === 2 && (
            <Button type="primary" onClick={() => setCurrentStep(0)}>
              Reiniciar
            </Button>
          )}
        </Space>

        <Divider>Tabla de Datos</Divider>

        <Table<TablaIndicador>
          columns={columnasTabla}
          dataSource={datosTabla}
          rowSelection={{
            selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
          }}
          pagination={{
            pageSize: 3,
            showSizeChanger: true,
            pageSizeOptions: ['3', '5', '10'],
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} registros`,
          }}
          scroll={{ x: 900 }}
        />

        <Divider>Tarjetas Anidadas</Divider>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card 
              title="Tarjeta 1" 
              bordered={false}
              extra={<Badge status="success" text="Activo" />}
            >
              <p>Contenido de la primera tarjeta con información importante.</p>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card 
              title="Tarjeta 2" 
              bordered={false}
              extra={<Badge status="processing" text="Procesando" />}
            >
              <p>Contenido de la segunda tarjeta con más detalles.</p>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
