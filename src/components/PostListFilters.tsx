import React from 'react';
import { useEffect, useState } from 'react';
import { Button, Form, Input, Select, Space } from 'antd';

type Filters = {
  status: string;
  q: string;
  sort: string;
  from: string;
  to: string;
};

function parseSearch(search: string): Filters {
  const params = new URLSearchParams(search || window.location.search);
  return {
    status: params.get('status') || 'all',
    q: params.get('q') || '',
    sort: params.get('sort') || 'newest',
    from: params.get('from') || '',
    to: params.get('to') || '',
  };
}

export default function PostListFilters({ onSearch }: { onSearch?: (f: Filters) => void }) {
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    q: '',
    sort: 'newest',
    from: '',
    to: '',
  });

  useEffect(() => {
    // Keep the list synchronized with URL state on first load and browser navigation.
    const urlFilters = parseSearch(window.location.search);
    setFilters(urlFilters);
    if (onSearch) onSearch(urlFilters);

    function onPop() {
      const f = parseSearch(window.location.search);
      setFilters(f);
      if (onSearch) onSearch(f);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [onSearch]);


  function handleFieldChange(name: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    window.history.pushState(null, '', `?${params.toString()}`);
    if (onSearch) onSearch(filters);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <Space size={[12, 12]} wrap align="end">
        <Form.Item label="Estado" style={{ marginBottom: 0, minWidth: 180 }}>
          <Select
            aria-label="Estado"
            value={filters.status}
            onChange={(value) => handleFieldChange('status', value)}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'approved', label: 'Aprobado' },
              { value: 'pending', label: 'Pendiente' },
              { value: 'rejected', label: 'Rechazado' },
              { value: 'disabled', label: 'Deshabilitado' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Buscar" style={{ marginBottom: 0, minWidth: 240 }}>
          <Input
            value={filters.q}
            onChange={(e) => handleFieldChange('q', e.target.value)}
            placeholder="Indicador o fuente"
            allowClear
          />
        </Form.Item>

        <Form.Item label="Ordenar" style={{ marginBottom: 0, minWidth: 180 }}>
          <Select
            aria-label="Ordenar"
            value={filters.sort}
            onChange={(value) => handleFieldChange('sort', value)}
            options={[
              { value: 'newest', label: 'Mas recientes' },
              { value: 'oldest', label: 'Mas antiguos' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Desde" style={{ marginBottom: 0 }}>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => handleFieldChange('from', e.target.value)}
            allowClear
          />
        </Form.Item>

        <Form.Item label="Hasta" style={{ marginBottom: 0 }}>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => handleFieldChange('to', e.target.value)}
            allowClear
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit">Filtrar</Button>
            <Button href="/postlist">Borrar filtros</Button>
          </Space>
        </Form.Item>
      </Space>
    </form>
  );
}
