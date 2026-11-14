import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import type { SeriePost, SerieDataPoint, SerieValidation } from '../lib/supabase';
import { useAuthSession } from '../lib/use-auth-session';
import { normalizeFrequency } from '../lib/frequency';
import { withBase } from '../lib/paths';

/** Derived from the canonical SeriePost status union. */
type PostStatus = SeriePost['status'];

/** Projection of SerieDataPoint used for the nested join result (post_id excluded). */
type SerieDataItem = Pick<SerieDataPoint, 'id' | 'date' | 'value'>;

/** Projection of SerieValidation for display; omits server-only fields. */
type Validation = Pick<SerieValidation, 'id' | 'validation_status' | 'validation_notes' | 'validated_at'>;

/**
 * SeriePost extended with its joined serie_data rows.
 * submitted_at is omitted because it is not selected in the detail query.
 */
type Post = Omit<SeriePost, 'submitted_at'> & { serie_data: SerieDataItem[] };

const STATUS_BADGE: Record<string, string> = {
  approved: 'badge-success',
  pending: 'badge-warning',
  rejected: 'badge-error',
  disabled: 'badge-ghost',
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Datos validados',
  pending: 'Pendiente',
  rejected: 'Datos no correctos o confiables',
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
  const { user: currentUser } = useAuthSession();
  const [post, setPost] = useState<Post | null>(null);
  const [postStatus, setPostStatus] = useState<PostStatus>('pending');
  const [pendingStatus, setPendingStatus] = useState<PostStatus>('pending');
  const [isUpdating, setIsUpdating] = useState(false);
  const updatingRef = useRef(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusReason, setStatusReason] = useState('');
  const [validations, setValidations] = useState<Validation[]>([]);
  const [existingValidation, setExistingValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [validationStatus, setValidationStatus] = useState('');
  const [validationNotes, setValidationNotes] = useState('');

  const postId = new URLSearchParams(window.location.search).get('id');

  const userRoles = currentUser?.app_metadata?.role;
  const isAdmin = Array.isArray(userRoles) && userRoles.includes('admin');
  const isEditor = Array.isArray(userRoles) && (userRoles.includes('editor') || userRoles.includes('admin'));
  const requiresReason = isAdmin || pendingStatus === 'rejected' || pendingStatus === 'disabled' || (postStatus === 'approved' && pendingStatus !== 'approved');

  const loadData = async () => {
    setLoading(true);
    setPageError(null);
    setSubmitResult(null);
    setExistingValidation(null);
    setValidations([]);

    const { data: postData, error: postError } = await supabase
      .from('serie_posts')
      .select(`
        id, indicator_id, data_source, url, frequency, status, notes,
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
    setPostStatus(postData.status);
    setPendingStatus(postData.status);

    if (postData.status !== 'pending' || isEditor) {
      const { data: valsData, error: valsError } = await supabase
        .from('serie_validations')
        .select('id, validation_status, validation_notes, validated_at')
        .eq('post_id', postId!);
      if (valsError) {
          setPageError('No se pudieron cargar las revisiones.');
          setLoading(false);
          return;
        }
        setValidations(valsData ?? []);
    }

    if (currentUser) {
      const { data: existVal, error: existingError } = await supabase
        .from('serie_validations')
        .select('id, validation_status, validation_notes')
        .eq('post_id', postId!)
        .eq('validated_by', currentUser.id)
        .maybeSingle();
      if (existingError) {
        setPageError('No se pudo consultar tu validación.');
        setLoading(false);
        return;
      }
      const userValidation = existVal ?? null;
      setExistingValidation(userValidation);

      if (userValidation && postData.status === 'pending' && !isEditor) {
        const { data: valsData, error: valsError } = await supabase
          .from('serie_validations')
          .select('id, validation_status, validation_notes, validated_at')
          .eq('post_id', postId!);
        if (valsError) {
          setPageError('No se pudieron cargar las revisiones.');
          setLoading(false);
          return;
        }
        setValidations(valsData ?? []);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!postId) {
      setPageError('No se proporcionó ID de publicación en la URL.');
      setLoading(false);
      return;
    }

    void loadData();
  }, [currentUser?.id, isEditor, postId]);

  const handleStatusUpdate = async () => {
    if (!isEditor || !post || updatingRef.current || pendingStatus === postStatus || (!isAdmin && postStatus === 'disabled')) return;
    if (requiresReason && !statusReason.trim()) {
      setStatusMessage('Indica el motivo del cambio de estado.');
      return;
    }

    updatingRef.current = true;
    setIsUpdating(true);
    setStatusMessage('Actualizando estado...');

    try {
      const { error } = await supabase.rpc('change_record_status', {
        p_type: 'series', p_id: post.id, p_status: pendingStatus, p_reason: statusReason,
      });

      if (error) {
        setStatusMessage('No se pudo actualizar el estado. Comprueba tus permisos y el estado actual de la publicación.');
        return;
      }

      setPostStatus(pendingStatus);
      setStatusReason('');
      setPost((prev) => (prev ? { ...prev, status: pendingStatus } : prev));
      setStatusMessage('Estado actualizado correctamente.');
    } catch {
      setStatusMessage('No se pudo actualizar el estado. Inténtalo de nuevo.');
    } finally {
      updatingRef.current = false;
      setIsUpdating(false);
    }
  };

  const handleValidationSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser || !post || !validationStatus) return;
    setSubmitting(true);
    setSubmitResult(null);

    const { error } = await supabase.from('serie_validations').insert({
      post_id: post.id,
      validated_by: currentUser.id,
      validation_status: validationStatus,
      validation_notes: validationNotes.trim() || null,
    });

    if (error) {
      setSubmitResult({ type: 'error', message: `Error: ${error.message}` });
      setSubmitting(false);
      return;
    }

    setSubmitResult({ type: 'success', message: 'Validación enviada exitosamente.' });
    setValidationStatus('');
    setValidationNotes('');
    setSubmitting(false);
    setTimeout(() => loadData(), 1500);
  };

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
        Cargando publicación…
      </div>
    );
  }

  if (pageError) {
    return (
      <div role="alert" className="alert alert-error m-4">
        <span>{pageError}</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div role="alert" className="alert alert-warning m-4">
        <span>Publicación no encontrada.</span>
      </div>
    );
  }

  const sortedData = [...post.serie_data].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const frequencyLabel = { annual: 'Anual', quarterly: 'Trimestral', monthly: 'Mensual', daily: 'Diaria' }[normalizeFrequency(post.frequency)];

  return (
    <article className="min-w-0 rounded-box border border-base-300 bg-base-100" aria-labelledby="post-title">
      <header className="space-y-4 border-b border-base-300 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 id="post-title" className="text-xl font-semibold leading-snug wrap-anywhere">{post.indicator_id}</h1>
            <p className="text-xs text-base-content/70">Publicación #{post.id.slice(-8)}</p>
          </div>
          <span className={`badge badge-sm badge-soft h-auto min-h-5 max-w-full py-1 whitespace-normal ${STATUS_BADGE[postStatus] ?? 'badge-neutral'}`}>
            {STATUS_LABEL[postStatus] ?? postStatus}
          </span>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <div className="min-w-0 flex-1 basis-48">
            <dt className="text-xs text-base-content/70">Fuente</dt>
            <dd className="mt-1 wrap-anywhere">{post.data_source || 'Sin fuente indicada'}</dd>
            {post.url && <dd className="mt-1"><a className="link link-primary inline-flex min-h-8 items-center gap-1 text-xs" href={post.url} target="_blank" rel="noopener noreferrer">
              Consultar fuente
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5"><path d="M14 4h6v6m0-6L10 14m0-10H4v16h16v-6" /></svg>
            </a></dd>}
          </div>
          <div><dt className="text-xs text-base-content/70">Frecuencia</dt><dd className="mt-1">{frequencyLabel}</dd></div>
          <div><dt className="text-xs text-base-content/70">Creado</dt><dd className="mt-1 tabular-nums"><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString('es-ES')}</time></dd></div>
        </dl>
        {post.notes && <div className="space-y-1 text-sm"><h2 className="text-xs font-normal text-base-content/70">Notas de la publicación</h2><p className="whitespace-pre-wrap wrap-anywhere">{post.notes}</p></div>}
      </header>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5 p-4 sm:p-5">
          <section aria-labelledby="series-title" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="series-title" className="text-sm font-semibold">Datos de la serie</h2>
              <span className="text-xs text-base-content/70">{post.serie_data.length} puntos · Más recientes primero</span>
            </div>
            {sortedData.length > 0 ? (
              <div className="max-h-112 overflow-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" tabIndex={0} role="region" aria-label="Datos de la serie; tabla desplazable">
                <table className="table table-sm table-pin-rows w-full tabular-nums">
                  <caption className="sr-only">Valores publicados, ordenados del período más reciente al más antiguo.</caption>
                  <thead><tr><th scope="col" className="w-10 text-right">#</th><th scope="col">Período</th><th scope="col" className="text-right">Valor reportado</th></tr></thead>
                  <tbody>{sortedData.map((d, index) => (
                    <tr key={d.id || String(index)}>
                      <td className="text-right text-base-content/70">{index + 1}</td>
                      <td className="whitespace-nowrap">{formatSeriesDate(d.date, post.frequency)}</td>
                      <td className="text-right">{new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(d.value)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="py-3 text-sm text-base-content/70">Sin datos de serie adjuntos.</p>}
          </section>

          {/* Reviews remain visible under the existing independent-review rules. */}
          {(post.status !== 'pending' || isEditor || existingValidation) && validations.length > 0 && (
            <section aria-labelledby="validations-title" className="space-y-2 border-t border-base-300 pt-4">
              <div className="flex items-baseline justify-between gap-2"><h2 id="validations-title" className="text-sm font-semibold">Validaciones recibidas</h2><span className="text-xs text-base-content/70">{validations.length} revisiones</span></div>
              <ul className="divide-y divide-base-300">
                {validations.map(val => <li key={val.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge badge-sm badge-soft h-auto min-h-5 max-w-full py-1 whitespace-normal ${STATUS_BADGE[val.validation_status] ?? 'badge-neutral'}`}>{STATUS_LABEL[val.validation_status] ?? val.validation_status}</span>
                    <time dateTime={val.validated_at} className="text-xs tabular-nums text-base-content/70">{new Date(val.validated_at).toLocaleString('es-ES')}</time>
                  </div>
                  <p className="whitespace-pre-wrap wrap-anywhere text-base-content/70">{val.validation_notes || 'Sin notas.'}</p>
                </li>)}
              </ul>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-5 border-t border-base-300 p-4 sm:p-5 lg:border-t-0 lg:border-l" aria-label="Revisión de la publicación">
          <section aria-labelledby="review-title" className="space-y-3">
            <h2 id="review-title" className="text-sm font-semibold">Tu validación</h2>
            {!currentUser && <p className="text-sm leading-normal text-base-content/70"><a href={withBase('/login')} className="link link-primary">Inicia sesión</a> para validar esta publicación.</p>}
            {existingValidation ? (
              <div className="space-y-2 text-sm">
                <p className="text-base-content/70">Ya validaste esta publicación.</p>
                <span className={`badge badge-sm badge-soft h-auto min-h-5 max-w-full py-1 whitespace-normal ${STATUS_BADGE[existingValidation.validation_status] ?? 'badge-neutral'}`}>{STATUS_LABEL[existingValidation.validation_status] ?? existingValidation.validation_status}</span>
                {existingValidation.validation_notes && <p className="whitespace-pre-wrap wrap-anywhere">{existingValidation.validation_notes}</p>}
              </div>
            ) : currentUser && currentUser.id === post.submitted_by ? (
              <p className="text-sm text-base-content/70">No puedes validar tu propia publicación.</p>
            ) : currentUser ? (
              <form onSubmit={handleValidationSubmit} className="space-y-3">
                <fieldset disabled={submitting} className="min-w-0 space-y-1">
                  <legend className="mb-1 text-xs text-base-content/70">Decisión de validación (obligatoria)</legend>
                  <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-field px-2 py-2 text-sm leading-normal text-success has-checked:bg-success/10">
                    <input type="radio" name="validation_status" value="approved" className="radio radio-sm radio-success mt-0.5 shrink-0" checked={validationStatus === 'approved'} onChange={e => setValidationStatus(e.target.value)} required />
                    <span>Los datos son correctos y confiables</span>
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-field px-2 py-2 text-sm leading-normal text-error has-checked:bg-error/10">
                    <input type="radio" name="validation_status" value="rejected" className="radio radio-sm radio-error mt-0.5 shrink-0" checked={validationStatus === 'rejected'} onChange={e => setValidationStatus(e.target.value)} required />
                    <span>Los datos no son correctos o confiables</span>
                  </label>
                </fieldset>
                <div className="space-y-1">
                  <label htmlFor="validation-notes" className="block text-xs text-base-content/70">Notas (opcional)</label>
                  <textarea id="validation-notes" className="textarea textarea-sm w-full text-base sm:text-sm" rows={3} placeholder="Comentarios u observaciones sobre estos datos…" value={validationNotes} onChange={e => setValidationNotes(e.target.value)} disabled={submitting} />
                </div>
                {submitResult && <div role="alert" className={`alert text-sm ${submitResult.type === 'success' ? 'alert-success' : 'alert-error'}`}><span>{submitResult.message}</span></div>}
                <button type="submit" className="btn btn-primary btn-sm min-h-11 w-full sm:min-h-8" disabled={!validationStatus || submitting}>
                  {submitting && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
                  {submitting ? 'Enviando…' : 'Enviar revisión'}
                </button>
              </form>
            ) : null}
          </section>

          {isEditor && <section className="space-y-3 border-t border-base-300 pt-4" aria-labelledby="status-title">
            <h2 id="status-title" className="text-sm font-semibold">Gestionar estado</h2>
            <div className="app-filters">
              <label className="filter-field w-full">Estado de la publicación
                <select className="select select-sm w-full" value={pendingStatus} onChange={e => setPendingStatus(e.target.value as PostStatus)} disabled={isUpdating || (!isAdmin && postStatus === 'disabled')}>
                  <option value="pending">Pendiente</option><option value="approved">Aprobado</option><option value="rejected">Rechazado</option><option value="disabled">Deshabilitado</option>
                </select>
              </label>
              {pendingStatus !== postStatus && requiresReason && <label className="filter-field w-full">Motivo del cambio (obligatorio)
                <input className="input input-sm w-full" value={statusReason} onChange={e => setStatusReason(e.target.value)} disabled={isUpdating} required />
              </label>}
              <button type="button" className="btn btn-sm btn-outline w-full" onClick={handleStatusUpdate} disabled={isUpdating || pendingStatus === postStatus || (!isAdmin && postStatus === 'disabled')}>
                {isUpdating ? 'Guardando…' : 'Confirmar cambio'}
              </button>
            </div>
            {statusMessage && <p role="status" className="text-sm wrap-anywhere">{statusMessage}</p>}
          </section>}
        </aside>
      </div>
    </article>
  );
};

export default PostDetail;
