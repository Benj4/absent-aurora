import { useState, useEffect } from 'react';
import type { FC } from 'react';
import {
  Alert, Button, Card, Descriptions, Divider, Empty, Form,
  Input, List, Radio, Space, Spin, Table, Tag, Typography,
} from 'antd';
import { supabase } from '../lib/supabase';
import { normalizeFrequency } from '../lib/frequency';

const { Title, Text } = Typography;

type PostStatus = 'pending' | 'approved' | 'rejected' | 'disabled';

interface SerieDataItem {
  id: string;
  date: string;
  value: number;
}

interface Validation {
  id: string;
  validation_status: string;
  validation_notes: string | null;
  validated_at: string;
}

interface Post {
  id: string;
  indicator_id: string;
  data_source: string;
  frequency: string;
  status: PostStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  submitted_by: string | null;
  serie_data: SerieDataItem[];
}

const STATUS_COLOR: Record<string, string> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
  disabled: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  disabled: 'Deshabilitado',
};

function formatSeriesDate(raw: string, frequency: string): string {
  const freq = normalizeFrequency(frequency);
  if (freq === 'annual') return raw.slice(0, 4);
  const d = new Date(raw);
  if (freq === 'monthly') return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
  if (freq === 'quarterly') {
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    return `T${quarter} ${d.getFullYear()}`;
  }
  return d.toLocaleDateString('es-ES');
}

const PostDetail: FC = () => {
  const [post, setPost] = useState<Post | null>(null);
  const [validations, setValidations] = useState<Validation[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [existingValidation, setExistingValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form] = Form.useForm();

  const postId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!postId) {
      setPageError('No se proporcionó ID de publicación en la URL.');
      setLoading(false);
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setPageError(null);
    setSubmitResult(null);
    setExistingValidation(null);
    setValidations([]);

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    const { data: postData, error: postError } = await supabase
      .from('serie_posts')
      .select(`
        id, indicator_id, data_source, frequency, status, notes,
        created_at, updated_at, submitted_by,
        serie_data(id, date, value)
      `)
      .eq('id', postId!)
      .single();

    if (postError) {
      setPageError(`Error al cargar la publicación: ${postError.message}`);
      setLoading(false);
      return;
    }

    if (!postData) {
      setPageError('Publicación no encontrada.');
      setLoading(false);
      return;
    }

    setPost(postData as Post);

    if (postData.status !== 'pending') {
      const { data: valsData, error: valsError } = await supabase
        .from('serie_validations')
        .select('id, validation_status, validation_notes, validated_at')
        .eq('post_id', postId!);
      if (!valsError && valsData) setValidations(valsData);
    }

    if (user && postData.status === 'pending') {
      const { data: existVal } = await supabase
        .from('serie_validations')
        .select('id, validation_status, validation_notes')
        .eq('post_id', postId!)
        .eq('validated_by', user.id)
        .single();
      setExistingValidation(existVal ?? null);
    }

    setLoading(false);
  };

  const handleValidationSubmit = async (values: {
    validation_status: string;
    validation_notes?: string;
  }) => {
    if (!currentUser || !post) return;
    setSubmitting(true);
    setSubmitResult(null);

    const { error } = await supabase.from('serie_validations').insert({
      post_id: post.id,
      validated_by: currentUser.id,
      validation_status: values.validation_status,
      validation_notes: values.validation_notes || null,
    });

    if (error) {
      setSubmitResult({ type: 'error', message: `Error: ${error.message}` });
      setSubmitting(false);
      return;
    }

    setSubmitResult({ type: 'success', message: 'Validación enviada exitosamente.' });
    setSubmitting(false);
    setTimeout(() => loadData(), 1500);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (pageError) {
    return <Alert type="error" title={pageError} showIcon />;
  }

  if (!post) {
    return <Alert type="warning" title="Publicación no encontrada." showIcon />;
  }

  const sortedData = [...post.serie_data].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const seriesColumns = [
    {
      title: '#',
      key: 'rank',
      width: 52,
      render: (_: unknown, __: unknown, index: number) => (
        <Text type="secondary">{index + 1}</Text>
      ),
    },
    {
      title: 'Periodo',
      dataIndex: 'date',
      key: 'date',
      defaultSortOrder: 'descend' as const,
      sorter: (a: SerieDataItem, b: SerieDataItem) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
      render: (date: string) => formatSeriesDate(date, post.frequency),
    },
    {
      title: 'Valor reportado',
      dataIndex: 'value',
      key: 'value',
      align: 'right' as const,
      render: (val: number) => (
        <Text strong>
          {new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(val)}
        </Text>
      ),
    },
  ];

  const descItems = [
    {
      key: 'source',
      label: 'Fuente',
      children: post.data_source || '—',
    },
    {
      key: 'frequency',
      label: 'Frecuencia',
      children: <Tag>{post.frequency}</Tag>,
    },
    {
      key: 'created',
      label: 'Creado',
      children: new Date(post.created_at).toLocaleString('es-ES'),
    },
    ...(post.updated_at
      ? [
          {
            key: 'updated',
            label: 'Actualizado',
            children: new Date(post.updated_at).toLocaleString('es-ES'),
          },
        ]
      : []),
    ...(post.notes
      ? [{ key: 'notes', label: 'Notas', children: post.notes, span: 3 }]
      : []),
  ];

  return (
    <Card
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            {post.indicator_id}
          </Title>
          <Text type="secondary">Publicación #{post.id.slice(-8)}</Text>
        </Space>
      }
      extra={
        <Space>
          <Tag>{post.frequency}</Tag>
          <Tag color={STATUS_COLOR[post.status]}>
            {STATUS_LABEL[post.status] ?? post.status}
          </Tag>
        </Space>
      }
    >
      <Descriptions items={descItems} bordered size="small" column={3} />

      <Divider>
        <Text type="secondary">
          Datos de la serie ({post.serie_data.length} puntos)
        </Text>
      </Divider>

      {sortedData.length > 0 ? (
        <Table
          dataSource={sortedData.map((d, i) => ({ ...d, key: d.id || String(i) }))}
          columns={seriesColumns}
          size="small"
          pagination={sortedData.length > 15 ? { pageSize: 15 } : false}
          rowClassName={(_, index) => (index % 2 === 0 ? '' : 'ant-table-row-stripe')}
        />
      ) : (
        <Empty description="Sin datos de serie adjuntos." />
      )}

      {/* Validaciones para publicaciones no pendientes */}
      {post.status !== 'pending' && validations.length > 0 && (
        <>
          <Divider>
            <Text type="secondary">Validaciones ({validations.length})</Text>
          </Divider>
          <List
            dataSource={validations}
            renderItem={(val) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={STATUS_COLOR[val.validation_status]}>
                        {STATUS_LABEL[val.validation_status] ?? val.validation_status}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(val.validated_at).toLocaleString('es-ES')}
                      </Text>
                    </Space>
                  }
                  description={
                    val.validation_notes ?? (
                      <Text type="secondary">Sin notas.</Text>
                    )
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}

      {/* Sección de revisión entre pares para publicaciones pendientes */}
      {post.status === 'pending' && (
        <>
          <Divider>Revisión entre pares</Divider>

          {!currentUser ? (
            <Alert
              type="warning"
              message={
                <span>
                  Por favor{' '}
                  <a href="/login">inicia sesión</a> para validar esta
                  publicación.
                </span>
              }
              showIcon
            />
          ) : existingValidation ? (
            <Alert
              type="info"
              message={
                <Space direction="vertical" size={2}>
                  <span>
                    Ya validaste esta publicación como:{' '}
                    <Tag color={STATUS_COLOR[existingValidation.validation_status]}>
                      {STATUS_LABEL[existingValidation.validation_status] ??
                        existingValidation.validation_status}
                    </Tag>
                  </span>
                  {existingValidation.validation_notes && (
                    <Text type="secondary">
                      Notas: {existingValidation.validation_notes}
                    </Text>
                  )}
                </Space>
              }
              showIcon
            />
          ) : (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleValidationSubmit}
              style={{ maxWidth: 600 }}
            >
              <Form.Item
                name="validation_status"
                label="Decisión de validación"
                rules={[
                  { required: true, message: 'Selecciona una decisión.' },
                ]}
              >
                <Radio.Group>
                  <Radio value="approved">
                    <Text style={{ color: '#52c41a' }}>Aprobar</Text>
                  </Radio>
                  <Radio value="rejected">
                    <Text style={{ color: '#ff4d4f' }}>Rechazar</Text>
                  </Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="validation_notes"
                label="Notas (opcional)"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Agrega comentarios u observaciones sobre estos datos..."
                />
              </Form.Item>

              {submitResult && (
                <Form.Item>
                  <Alert
                    type={submitResult.type}
                    message={submitResult.message}
                    showIcon
                  />
                </Form.Item>
              )}

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                >
                  Enviar Validación
                </Button>
              </Form.Item>
            </Form>
          )}
        </>
      )}
    </Card>
  );
};

export default PostDetail;
