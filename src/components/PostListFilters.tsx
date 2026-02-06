import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

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
    // Run initial search if there are active filters in the URL; otherwise keep server-provided posts
    const urlFilters = parseSearch(window.location.search);
    const hasAnyFilter = Object.values(urlFilters).some(v => v && v !== 'all' && v !== '');
    if (hasAnyFilter) {
      setFilters(urlFilters);
      if (onSearch) onSearch(urlFilters);
    }

    function onPop() {
      const f = parseSearch(window.location.search);
      setFilters(f);
      if (onSearch) onSearch(urlFilters);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);


  function handleChange(e: Event) {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const name = target.name as keyof Filters;
    const value = target.value;
    setFilters(prev => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    const params = new URLSearchParams(filters);
    window.history.pushState(null, '', `?${params.toString()}`);
    if (onSearch) onSearch(filters);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end mb-6">
      {/* {JSON.stringify(filters)} */}
      <div>
        <label className="text-sm font-semibold block">Estado</label>
        <select name="status" className="border rounded p-2" aria-label="Estado" value={filters.status} onChange={handleChange}>
          <option value="all">Todos</option>
          <option value="approved">Aprobado</option>
          <option value="pending">Pendiente</option>
          <option value="rejected">Rechazado</option>
          <option value="disabled">Deshabilitado</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-semibold block">Buscar</label>
        <input name="q" value={filters.q} onInput={handleChange} placeholder="Indicador o fuente" className="border rounded p-2" />
      </div>

      <div>
        <label className="text-sm font-semibold block">Ordenar</label>
        <select name="sort" className="border rounded p-2" aria-label="Ordenar" value={filters.sort} onChange={handleChange}>
          <option value="newest">Más recientes</option>
          <option value="oldest">Más antiguos</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-semibold block">Desde</label>
        <input type="date" name="from" value={filters.from} onChange={handleChange} className="border rounded p-2" />
      </div>

      <div>
        <label className="text-sm font-semibold block">Hasta</label>
        <input type="date" name="to" value={filters.to} onChange={handleChange} className="border rounded p-2" />
      </div>

      <div>
        <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded">Filtrar</button>
        <a href="/postlist" className="ml-3 text-sm text-gray-600">Borrar filtros</a>
      </div>
    </form>
  );
}
