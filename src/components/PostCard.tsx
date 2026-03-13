import type { FC } from 'react';
import { Button, Card, Descriptions, Empty, Space, Table, Tag, Typography } from 'antd';
import { withBase } from '../lib/paths';

const { Title, Text } = Typography;

// NOTE: Use local types compatible with server responses. Prefer importing from `src/lib/supabase` when possible.
interface SerieData {
  id?: number | string;
  date: string;
  value: number;
}

interface Post {
  id: number | string;
  indicator_id: string;
  data_source?: string;
  frequency: string;
  status: string;
  created_at: string;
  updated_at?: string;
  serie_data?: SerieData[];
}

interface Props {
  post: Post;
  maxDataPoints?: number;
  showLinks?: boolean;
}

const statusColor = (status: string) => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
      return 'error';
    case 'disabled':
      return 'default';
    default:
      return 'default';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'approved':
      return 'Aprobado';
    case 'pending':
      return 'Pendiente';
    case 'rejected':
      return 'Rechazado';
    case 'disabled':
      return 'Deshabilitado';
    default:
      return status;
  }
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('es-ES')} a las ${d.toLocaleTimeString('es-ES')}`;
  } catch (e) {
    return iso;
  }
};

const formatSeriesDate = (raw: string, frequency: string) => {
  if (!raw) return raw;
  if (frequency === 'annual') return raw;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('es-ES');
};

const formatValue = (value: number) => {
  if (!Number.isFinite(value)) return String(value);
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(value);
};

const PostCard: FC<Props> = ({ post, maxDataPoints = 10, showLinks = true }) => {
  const serie = post.serie_data || [];
  const sorted = [...serie].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const slice = sorted.slice(0, maxDataPoints);
  const shouldShowSerie = maxDataPoints > 0;
  const latest = sorted[0];
  const oldest = sorted[sorted.length - 1];

  const tableData = slice.map((data, index) => {
    const previous = slice[index + 1];
    const variation = previous ? data.value - previous.value : null;

    return {
      rank: index + 1,
    key: String(data.id ?? `${data.date}-${data.value}`),
    date: formatSeriesDate(data.date, post.frequency),
      rawDate: data.date,
    value: formatValue(data.value),
      rawValue: data.value,
      variation,
    };
  });

  return (
    <Card
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>{post.indicator_id}</Title>
          <Text type="secondary">Publicacion #{post.id}</Text>
        </div>
      }
      extra={
        <Space size={8} wrap>
          <Tag>{post.frequency}</Tag>
          <Tag color={statusColor(post.status)}>{statusLabel(post.status)}</Tag>
        </Space>
      }
      style={{ width: '100%' }}
    >
      <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
        <Descriptions.Item label="Fuente">{post.data_source || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Frecuencia">{post.frequency}</Descriptions.Item>
        <Descriptions.Item label="Creado">{formatDate(post.created_at)}</Descriptions.Item>
        {post.updated_at && (
          <Descriptions.Item label="Actualizado" span={3}>{formatDate(post.updated_at)}</Descriptions.Item>
        )}
      </Descriptions>

      {shouldShowSerie && serie.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Space size={16} wrap style={{ marginBottom: 8 }}>
            <Text strong>Puntos: {serie.length}</Text>
            {latest && (
              <Text type="secondary">
                Ultimo: {formatSeriesDate(latest.date, post.frequency)} ({formatValue(latest.value)})
              </Text>
            )}
            {oldest && (
              <Text type="secondary">
                Primero: {formatSeriesDate(oldest.date, post.frequency)}
              </Text>
            )}
          </Space>

          <Table
            className="postcard-ant-table"
            size="small"
            pagination={tableData.length > 8 ? { pageSize: 8, size: 'small', hideOnSinglePage: true } : false}
            scroll={{ x: 560 }}
            dataSource={tableData}
            // rowClassName={(record, rowIndex) => {
            //   if (record.rank === 1) return 'bg-green-500/10';
            //   return (rowIndex ?? 0) % 2 === 0 ? 'bg-black/5' : '';
            // }}
            locale={{ emptyText: 'Sin datos para mostrar' }}
            columns={[
              {
                title: '#',
                dataIndex: 'rank',
                key: 'rank',
                width: 64,
                align: 'center',
                render: (rank: number) => <Text type="secondary">{rank}</Text>,
              },
              {
                title: 'Periodo',
                dataIndex: 'date',
                key: 'date',
                sorter: (a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime(),
                defaultSortOrder: 'descend',
                render: (period: string, record) => (
                  <Space size={8}>
                    <Text>{period}</Text>
                    {/* {record.rank === 1 && <Tag color="success">reciente</Tag>} */}
                  </Space>
                ),
              },
              {
                title: 'Valor reportado',
                dataIndex: 'value',
                key: 'value',
                align: 'right',
                sorter: (a, b) => a.rawValue - b.rawValue,
                render: (value: string) => <Text strong>{value}</Text>,
              },
              {
                title: 'Variacion',
                dataIndex: 'variation',
                key: 'variation',
                align: 'right',
                width: 140,
                render: (variation: number | null) => {
                  if (variation === null) return <Text type="secondary">-</Text>;
                  const isPositive = variation > 0;
                  const isNegative = variation < 0;

                  if (!isPositive && !isNegative) {
                    return <Text type="secondary">0</Text>;
                  }

                  return (
                    <Text type={isPositive ? 'success' : 'danger'}>
                      {isPositive ? '+' : ''}
                      {formatValue(variation)}
                    </Text>
                  );
                },
              },
            ]}
          />

          {serie.length > maxDataPoints && (
            <Text type="secondary" italic>
              Mostrando {maxDataPoints} de {serie.length} puntos (mas recientes)
            </Text>
          )}
        </div>
      )}

      {shouldShowSerie && serie.length === 0 && (
        <div style={{ marginTop: 16 }}>
          <Empty description="No hay datos de serie adjuntos a esta publicacion." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )}

      {showLinks && (
        <div style={{ marginTop: 12 }}>
          <Button type="link" href={withBase(`/post?id=${post.id}`)} style={{ paddingInline: 0 }}>
            Revisar y validar
          </Button>
        </div>
      )}
    </Card>
  );
};

export default PostCard;
