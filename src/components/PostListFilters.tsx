import React from 'react';
import { useEffect, useState } from 'react';
import { withBase } from '../lib/paths';

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
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end mb-6">
      <label className="form-control">
        <div className="label py-0">
          <span className="label-text text-xs">Estado</span>
        </div>
        <select
          className="select select-sm select-bordered min-w-[160px]"
          aria-label="Estado"
          value={filters.status}
          onChange={(e) => handleFieldChange('status', e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="approved">Aprobado</option>
          <option value="pending">Pendiente</option>
          <option value="rejected">Rechazado</option>
          <option value="disabled">Deshabilitado</option>
        </select>
      </label>

      <label className="form-control">
        <div className="label py-0">
          <span className="label-text text-xs">Buscar</span>
        </div>
        <input
          type="text"
          className="input input-sm input-bordered min-w-[220px]"
          value={filters.q}
          onChange={(e) => handleFieldChange('q', e.target.value)}
          placeholder="Indicador o fuente"
        />
      </label>

      <label className="form-control">
        <div className="label py-0">
          <span className="label-text text-xs">Ordenar</span>
        </div>
        <select
          className="select select-sm select-bordered min-w-[160px]"
          aria-label="Ordenar"
          value={filters.sort}
          onChange={(e) => handleFieldChange('sort', e.target.value)}
        >
          <option value="newest">Más recientes</option>
          <option value="oldest">Más antiguos</option>
        </select>
      </label>

      <label className="form-control">
        <div className="label py-0">
          <span className="label-text text-xs">Desde</span>
        </div>
        <input
          type="date"
          className="input input-sm input-bordered"
          value={filters.from}
          onChange={(e) => handleFieldChange('from', e.target.value)}
        />
      </label>

      <label className="form-control">
        <div className="label py-0">
          <span className="label-text text-xs">Hasta</span>
        </div>
        <input
          type="date"
          className="input input-sm input-bordered"
          value={filters.to}
          onChange={(e) => handleFieldChange('to', e.target.value)}
        />
      </label>

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm">
          Filtrar
        </button>
        <a href={withBase('/postlist')} className="btn btn-ghost btn-sm">
          Borrar filtros
        </a>
      </div>
    </form>
  );
}
