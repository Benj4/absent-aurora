import type { FC } from 'react';
import type { Periodo } from './analysis-builder.types';

const PeriodRow: FC<{
  periodo: Periodo;
  canRemove: boolean;
  onChange: (field: keyof Periodo, value: string) => void;
  onRemove: () => void;
}> = ({ periodo, canRemove, onChange, onRemove }) => (
  <div
    className="rounded-box border border-base-200 bg-base-100 p-3 space-y-2.5"
    style={{ borderLeftColor: periodo.color, borderLeftWidth: 3 }}
  >
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Color del período"
        value={periodo.color}
        onChange={e => onChange('color', e.target.value)}
        className="h-7 w-7 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
      />
      <input
        type="text"
        aria-label="Nombre del período"
        className="input input-sm flex-1 min-w-0"
        placeholder="Ej. Gobierno 2018-2022…"
        value={periodo.nombre}
        onChange={e => onChange('nombre', e.target.value)}
        maxLength={40}
        autoComplete="off"
      />
      {canRemove && (
        <button
          type="button"
          aria-label={`Eliminar ${periodo.nombre}`}
          className="btn btn-ghost btn-xs text-error hover:bg-error/10"
          onClick={onRemove}
        >✕</button>
      )}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="label py-0 pb-1">
          <span className="label-text text-xs">Inicio</span>
        </label>
        <input
          type="date"
          aria-label={`Fecha de inicio de ${periodo.nombre}`}
          className="input input-sm w-full"
          value={periodo.fechaInicio}
          onChange={e => onChange('fechaInicio', e.target.value)}
        />
      </div>
      <div>
        <label className="label py-0 pb-1">
          <span className="label-text text-xs">Fin</span>
        </label>
        <input
          type="date"
          aria-label={`Fecha de fin de ${periodo.nombre}`}
          className="input input-sm w-full"
          value={periodo.fechaFin}
          onChange={e => onChange('fechaFin', e.target.value)}
        />
      </div>
    </div>
  </div>
);

export default PeriodRow;
