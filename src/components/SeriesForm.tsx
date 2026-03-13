import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Alert, Button, DatePicker, Input, Space, Table, Typography } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { normalizeFrequency, getDateHint, validateDate } from '../lib/frequency';

interface Indicator {
  id: string;
  label: string;
  nativeFrequency: string;
  unit?: {
    symbol?: string;
    type?: string;
  };
}

interface DataRow {
  date: string;
  value: string;
}

interface Props {
  indicator: Indicator;
}

type StatusType = 'idle' | 'loading' | 'success' | 'error';

const { Text } = Typography;

const INITIAL_ROWS: DataRow[] = [
  { date: '', value: '' },
  { date: '', value: '' },
  { date: '', value: '' },
  { date: '', value: '' },
];

const SeriesForm: FC<Props> = ({ indicator }) => {
  const [dataSource, setDataSource] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<DataRow[]>(INITIAL_ROWS);
  const [status, setStatus] = useState<StatusType>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const canonicalFreq = normalizeFrequency(indicator.nativeFrequency ?? '');
  const dateHint = getDateHint(canonicalFreq);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    setIsAuthenticated(!error && !!user);
    if (error || !user) console.log('No authenticated user');
  };

  const addRow = () => {
    setRows([...rows, { date: '', value: '' }]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const updateRow = (index: number, field: 'date' | 'value', value: string) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const updateDateRow = (index: number, value: dayjs.Dayjs | null ) => {
    const updated = [...rows];


    if (value) {
      let formattedDate: string;
      switch (canonicalFreq) {
        case 'annual':
          formattedDate = value.month(0).date(1).format('YYYY-MM-DD');
          break;
        case 'quarterly': {
          const quarterStartMonth = Math.floor(value.month() / 3) * 3; // 0, 3, 6, or 9
          formattedDate = value.month(quarterStartMonth).date(1).format('YYYY-MM-DD');
          break;
        }
        case 'monthly':
          formattedDate = value.date(1).format('YYYY-MM-DD');
          break;
        case 'daily':
          formattedDate = value.format('YYYY-MM-DD');
          break;
      }
      updated[index].date = formattedDate;
    } else {
      updated[index].date = '';
    }

    setRows(updated);
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMessage('');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Debes iniciar sesión para enviar datos. Por favor, inicia sesión primero.');
      }

      if (!dataSource || dataSource.trim() === '') {
        throw new Error('Por favor, completa todos los campos requeridos.');
      }

      const validRows = rows.filter(row => row.date.trim() !== '' && row.value.trim() !== '');
      if (validRows.length < 1) {
        throw new Error('Por favor, proporciona al menos 1 punto de datos.');
      }

      console.log('validRows :>> ', validRows);

      for (const row of validRows) {
        const dateError = validateDate(row.date, canonicalFreq);
        if (dateError) throw new Error(dateError);
      }

      const validData = validRows.map(row => ({
        date: row.date,
        value: parseFloat(row.value),
      }));

      const invalidValues = validData.filter(item => isNaN(item.value));
      if (invalidValues.length > 0) {
        throw new Error('Por favor, ingresa valores numéricos válidos.');
      }

      // Step 1: Insert serie_posts record
      const { data: postData, error: postError } = await supabase
        .from('serie_posts')
        .insert({
          indicator_id: indicator.id,
          data_source: dataSource,
          frequency: indicator.nativeFrequency,
          status: 'pending',
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (postError) throw postError;

      // Step 2: Insert serie_data records
      const dataPoints = validData.map(item => ({
        post_id: postData.id,
        date: item.date,
        value: item.value,
      }));

      const { error: dataError } = await supabase.from('serie_data').insert(dataPoints);
      if (dataError) throw dataError;

      setStatus('success');
      setStatusMessage(`✓ ¡Datos enviados exitosamente! ${validData.length} puntos de datos agregados.`);
      setDataSource('');
      setNotes('');
      setRows(INITIAL_ROWS);
    } catch (error: any) {
      console.error('Error en el envío:', error);
      setStatus('error');
      setStatusMessage(`✗ Error: ${error.message || 'Error al enviar los datos'}`);
    }
  };

  const unitSymbol = indicator.unit?.symbol || indicator.unit?.type || '';

  const pickerType = (
    canonicalFreq === 'annual' ? 'year' :
    canonicalFreq === 'quarterly' ? 'quarter' :
    canonicalFreq === 'monthly' ? 'month' :
    'date'
  ) as 'year' | 'quarter' | 'month' | 'date';

  const tableRows = rows.map((row, index) => ({
    key: index.toString(),
    index,
    ...row,
  }));

  const columns = [
    {
      title: 'Fecha',
      dataIndex: 'date',
      key: 'date',
      render: (_: string, row: { index: number; date: string }) => (
        <DatePicker
          picker={pickerType}
          value={row.date ? dayjs(row.date) : null}
          onChange={(val) => updateDateRow(row.index, val)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Valor',
      dataIndex: 'value',
      key: 'value',
      render: (_: string, row: { index: number; value: string }) => (
        <Input
          type="number"
          step="any"
          value={row.value}
          onChange={(e) => updateRow(row.index, 'value', e.target.value)}
          placeholder="0.00"
          addonAfter={unitSymbol || undefined}
        />
      ),
    },
    {
      title: 'Acción',
      key: 'action',
      width: 96,
      align: 'center' as const,
      render: (_: unknown, row: { index: number }) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeRow(row.index)}
          disabled={rows.length <= 1}
          aria-label="Eliminar fila"
        />
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          href={`/indicators/${indicator.id}/data`}
        >
          Volver a datos del indicador
        </Button>
      </div>
      <form onSubmit={handleSubmit}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>Fuente de Datos</Text>
            <Input
              style={{ marginTop: 8 }}
              type="text"
              id="data-source"
              name="data-source"
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              placeholder="ej., Banco Central, INE"
              required
            />
          </div>

          <div>
            <Text strong>Notas <Text type="secondary">(opcional)</Text></Text>
            <TextArea
              style={{ marginTop: 8 }}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Comentarios adicionales sobre este ingreso de datos..."
            />
          </div>

          <div>
            <Text strong>Valores de la Serie (mínimo 1 fila)</Text>
            <div style={{ marginTop: 4, marginBottom: 10 }}>
              <Text type="secondary">{dateHint}</Text>
            </div>
            <Table
              dataSource={tableRows}
              columns={columns}
              pagination={false}
              bordered
              size="small"
              scroll={{ x: 720 }}
            />
            <Button type="dashed" icon={<PlusOutlined />} onClick={addRow} style={{ marginTop: 10 }}>
              Agregar Fila
            </Button>
          </div>

          {!isAuthenticated && (
            <Alert
              type="warning"
              message="Debes iniciar sesión para enviar datos."
              showIcon
            />
          )}

          <div>
            <Button
              htmlType="submit"
              type="primary"
              loading={status === 'loading'}
              disabled={!isAuthenticated}
            >
              Enviar Datos de Series
            </Button>

            {statusMessage && (
              <div style={{ marginTop: 10 }}>
                <Alert
                  type={status === 'success' ? 'success' : status === 'error' ? 'error' : 'info'}
                  message={statusMessage}
                  showIcon
                />
              </div>
            )}
          </div>
        </Space>
      </form>
    </div>
  );
};

export default SeriesForm;
