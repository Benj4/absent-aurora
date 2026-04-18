import { useState, useEffect, useRef } from 'react';
import { useId } from 'react';
import type { FC } from 'react';
import { ALL_INDICATORS, INDICATOR_MAP } from './analysis-builder.data';

const MAX_INDICATORS = 5;

const IndicatorSelector: FC<{ selected: string[]; onToggle: (id: string) => void }> = ({ selected, onToggle }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchId = useId();

  useEffect(() => {
    const onOut = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const filtered = ALL_INDICATORS.filter(
    ind =>
      ind.label.toLowerCase().includes(search.toLowerCase()) ||
      ind.id.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 100);

  return (
    <div ref={containerRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Abrir selector de indicadores"
        className="w-full min-h-10 rounded-btn border border-base-300 bg-base-100 px-3 py-1.5 text-left text-sm flex flex-wrap gap-1 items-center hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors cursor-pointer"
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
      >
        {selected.length === 0 ? (
          <span className="text-base-content/40 text-sm">Buscar indicador…</span>
        ) : (
          selected.map(id => (
            <span key={id} className="badge badge-primary badge-sm gap-1 font-mono">
              {id}
              <button
                type="button"
                aria-label={`Quitar ${INDICATOR_MAP.get(id) ?? id}`}
                className="hover:opacity-70 leading-none"
                onClick={e => { e.stopPropagation(); onToggle(id); }}
              >×</button>
            </span>
          ))
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Lista de indicadores"
          className="absolute z-50 left-0 right-0 top-full mt-1 rounded-box border border-base-300 bg-base-100 shadow-2xl flex flex-col"
          style={{ maxHeight: 300 }}
        >
          <div className="p-2 border-b border-base-200 shrink-0">
            <label htmlFor={searchId} className="sr-only">Filtrar indicadores</label>
            <input
              id={searchId}
              autoFocus
              type="search"
              className="input input-sm w-full"
              placeholder="Filtrar…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-base-content/40">Sin resultados</p>
            ) : (
              filtered.map(ind => {
                const sel = selected.includes(ind.id);
                const disabled = !sel && selected.length >= MAX_INDICATORS;
                return (
                  <button
                    key={ind.id}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    disabled={disabled}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${sel ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-base-200'} disabled:opacity-40 disabled:cursor-not-allowed`}
                    onClick={() => !disabled && onToggle(ind.id)}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs checkbox-primary"
                      checked={sel}
                      onChange={() => {}}
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{ind.label}</span>
                    <span className="font-mono text-xs text-base-content/40 shrink-0">{ind.id}</span>
                  </button>
                );
              })
            )}
          </div>
          {selected.length >= MAX_INDICATORS && (
            <p className="px-3 py-2 text-xs text-warning border-t border-base-200 shrink-0">
              Máximo {MAX_INDICATORS} indicadores seleccionados
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default IndicatorSelector;
