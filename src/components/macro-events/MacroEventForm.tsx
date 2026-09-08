import { useEffect, useRef, useState } from 'react';
import type { MacroEvent, MacroEventDraft, MacroEventTopic } from '../../lib/macro-events';
import { createMacroEvent, updateMacroEvent } from '../../lib/macro-events';

const TOPICS: { value: MacroEventTopic; label: string }[] = [
  { value: 'politics', label: 'Política' },
  { value: 'economy', label: 'Economía' },
  { value: 'nature', label: 'Naturaleza' },
  { value: 'health', label: 'Salud' },
  { value: 'social', label: 'Social' },
];

type FormState = {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  geo_scope: string;
  geo_region: string;
  topic: MacroEventTopic | '';
  source_url: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  geo_scope: '',
  geo_region: '',
  topic: '',
  source_url: '',
};

interface Props {
  isOpen: boolean;
  event?: MacroEvent | null;
  onClose: () => void;
  onSaved: (event: MacroEvent) => void;
}

function validate(form: FormState, isPeriod: boolean): FormErrors {
  const errs: FormErrors = {};
  if (!form.name.trim()) errs.name = 'El nombre es obligatorio.';
  if (!form.start_date) errs.start_date = 'La fecha es obligatoria.';
  if (isPeriod && !form.end_date) errs.end_date = 'La fecha de fin es obligatoria.';
  if (isPeriod && form.start_date && form.end_date && form.end_date < form.start_date) {
    errs.end_date = 'Debe ser posterior a la fecha de inicio.';
  }
  if (!form.topic) errs.topic = 'El tema es obligatorio.';
  if (!form.source_url.trim()) {
    errs.source_url = 'La URL es obligatoria.';
  } else {
    try {
      const { protocol } = new URL(form.source_url.trim());
      if (protocol !== 'http:' && protocol !== 'https:') {
        errs.source_url = 'Debe comenzar con http:// o https://';
      }
    } catch {
      errs.source_url = 'La URL no tiene un formato válido.';
    }
  }
  return errs;
}

export default function MacroEventForm({ isOpen, event, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isPeriod, setIsPeriod] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(event);

  useEffect(() => {
    if (isOpen) {
      if (event) {
        setForm({
          name: event.name,
          description: event.description ?? '',
          start_date: event.start_date,
          end_date: event.end_date ?? '',
          geo_scope: event.geo_scope ?? '',
          geo_region: event.geo_region ?? '',
          topic: event.topic,
          source_url: event.source_url,
        });
        setIsPeriod(Boolean(event.end_date));
      } else {
        setForm(EMPTY);
        setIsPeriod(false);
      }
      setErrors({});
      setSubmitError(null);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen, event]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  function field(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate(form, isPeriod);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const draft: MacroEventDraft = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: isPeriod ? (form.end_date || null) : null,
      geo_scope: form.geo_scope.trim() || null,
      geo_region: form.geo_region.trim() || null,
      topic: form.topic as MacroEventTopic,
      source_url: form.source_url.trim(),
    };

    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = isEdit
      ? await updateMacroEvent(event!.id, draft)
      : await createMacroEvent(draft);

    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
    } else {
      onSaved(data as MacroEvent);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden rounded-box border border-base-200 bg-base-100 shadow-xl sm:max-h-[calc(100svh-3rem)]">
      <div className="flex flex-none items-center justify-between gap-4 border-b border-base-200 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">
            {isEdit ? 'Editar evento' : 'Nuevo evento'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar formulario"
          className="btn btn-ghost btn-sm btn-circle"
        >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Scrollable body + sticky footer, all inside the form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {submitError && (
              <div role="alert" aria-live="polite" className="alert alert-error mb-4 text-sm py-2.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" />
                </svg>
                <span>{submitError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-box border border-base-200 bg-base-200/20 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="form-control sm:col-span-2">
                    <label htmlFor="ev-name" className="label justify-start pb-1.5">
                      <span className="label-text font-medium">
                        Nombre<span aria-hidden="true" className="ml-0.5 text-error">*</span>
                      </span>
                    </label>
                    <input
                      ref={firstInputRef}
                      id="ev-name"
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={e => field('name', e.target.value)}
                      placeholder="Ej: Crisis financiera de 2008…"
                      autoComplete="off"
                      spellCheck={false}
                      aria-required="true"
                      aria-describedby={errors.name ? 'err-name' : undefined}
                      aria-invalid={Boolean(errors.name)}
                      className={`input input-bordered w-full${errors.name ? ' input-error' : ''}`}
                    />
                    {errors.name && (
                      <p id="err-name" role="alert" className="mt-1.5 text-xs text-error">{errors.name}</p>
                    )}
                  </div>

                  <div className="form-control">
                    <label htmlFor="ev-topic" className="label justify-start pb-1.5">
                      <span className="label-text font-medium">
                        Tema<span aria-hidden="true" className="ml-0.5 text-error">*</span>
                      </span>
                    </label>
                    <select
                      id="ev-topic"
                      name="topic"
                      value={form.topic}
                      onChange={e => field('topic', e.target.value)}
                      aria-required="true"
                      aria-describedby={errors.topic ? 'err-topic' : undefined}
                      aria-invalid={Boolean(errors.topic)}
                      className={`select select-bordered w-full${errors.topic ? ' select-error' : ''}`}
                    >
                      <option value="" disabled>Seleccionar tema…</option>
                      {TOPICS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {errors.topic && (
                      <p id="err-topic" role="alert" className="mt-1.5 text-xs text-error">{errors.topic}</p>
                    )}
                  </div>

                  <div className="form-control">
                    <label htmlFor="ev-url" className="label justify-start pb-1.5">
                      <span className="label-text font-medium">
                        URL de la fuente<span aria-hidden="true" className="ml-0.5 text-error">*</span>
                      </span>
                    </label>
                    <input
                      id="ev-url"
                      type="url"
                      name="source_url"
                      value={form.source_url}
                      onChange={e => field('source_url', e.target.value)}
                      placeholder="https://…"
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      aria-required="true"
                      aria-describedby={errors.source_url ? 'err-url' : undefined}
                      aria-invalid={Boolean(errors.source_url)}
                      className={`input input-bordered w-full${errors.source_url ? ' input-error' : ''}`}
                    />
                    {errors.source_url && (
                      <p id="err-url" role="alert" className="mt-1.5 text-xs text-error">{errors.source_url}</p>
                    )}
                  </div>

                  <div className="form-control sm:col-span-2">
                    <label htmlFor="ev-desc" className="label justify-start pb-1.5">
                      <span className="label-text font-medium">Descripción</span>
                    </label>
                    <textarea
                      id="ev-desc"
                      name="description"
                      value={form.description}
                      onChange={e => field('description', e.target.value)}
                      placeholder="Contexto adicional sobre el evento…"
                      rows={4}
                      className="textarea textarea-bordered w-full resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-box border border-base-200 bg-base-200/20 p-4 space-y-4">
                <label
                  htmlFor="ev-period"
                  className="flex cursor-pointer select-none items-center gap-3 rounded-lg border border-base-200 px-4 py-3 transition-colors duration-150 hover:bg-base-200/40"
                >
                  <input
                    id="ev-period"
                    type="checkbox"
                    checked={isPeriod}
                    onChange={e => {
                      setIsPeriod(e.target.checked);
                      if (!e.target.checked) field('end_date', '');
                    }}
                    className="checkbox checkbox-primary checkbox-sm"
                  />
                  <span className="text-sm">Este evento abarca múltiples días</span>
                </label>

                <div className={`grid grid-cols-1 gap-4${isPeriod ? ' sm:grid-cols-2' : ''}`}>
                  <div className="form-control">
                    <label htmlFor="ev-start" className="label justify-start pb-1.5">
                      <span className="label-text font-medium">
                        {isPeriod ? 'Inicio' : 'Fecha'}
                        <span aria-hidden="true" className="ml-0.5 text-error">*</span>
                      </span>
                    </label>
                    <input
                      id="ev-start"
                      type="date"
                      name="start_date"
                      value={form.start_date}
                      onChange={e => field('start_date', e.target.value)}
                      aria-required="true"
                      aria-describedby={errors.start_date ? 'err-start' : undefined}
                      aria-invalid={Boolean(errors.start_date)}
                      className={`input input-bordered w-full${errors.start_date ? ' input-error' : ''}`}
                    />
                    {errors.start_date && (
                      <p id="err-start" role="alert" className="mt-1.5 text-xs text-error">{errors.start_date}</p>
                    )}
                  </div>

                  {isPeriod && (
                    <div className="form-control">
                      <label htmlFor="ev-end" className="label justify-start pb-1.5">
                        <span className="label-text font-medium">
                          Fin<span aria-hidden="true" className="ml-0.5 text-error">*</span>
                        </span>
                      </label>
                      <input
                        id="ev-end"
                        type="date"
                        name="end_date"
                        value={form.end_date}
                        onChange={e => field('end_date', e.target.value)}
                        min={form.start_date || undefined}
                        aria-required="true"
                        aria-describedby={errors.end_date ? 'err-end' : undefined}
                        aria-invalid={Boolean(errors.end_date)}
                        className={`input input-bordered w-full${errors.end_date ? ' input-error' : ''}`}
                      />
                      {errors.end_date && (
                        <p id="err-end" role="alert" className="mt-1.5 text-xs text-error">{errors.end_date}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-box border border-base-200 bg-base-200/20 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="form-control">
                    <label htmlFor="ev-geo-scope" className="label justify-start pb-1.5">
                      <span className="label-text font-medium">Alcance</span>
                    </label>
                    <input
                      id="ev-geo-scope"
                      type="text"
                      name="geo_scope"
                      value={form.geo_scope}
                      onChange={e => field('geo_scope', e.target.value)}
                      placeholder="Global, Nacional…"
                      autoComplete="off"
                      className="input input-bordered w-full"
                    />
                  </div>

                  <div className="form-control">
                    <label htmlFor="ev-geo-region" className="label justify-start pb-1.5">
                      <span className="label-text font-medium">Región</span>
                    </label>
                    <input
                      id="ev-geo-region"
                      type="text"
                      name="geo_region"
                      value={form.geo_region}
                      onChange={e => field('geo_region', e.target.value)}
                      placeholder="US, LATAM, EU…"
                      autoComplete="off"
                      className="input input-bordered w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="flex flex-none items-center justify-end gap-3 border-t border-base-200 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-ghost btn-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-sm min-w-28"
            >
              {submitting ? (
                <>
                  <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                  Guardando…
                </>
              ) : isEdit ? 'Guardar cambios' : 'Crear evento'}
            </button>
          </div>
        </form>
    </div>
  );
}
