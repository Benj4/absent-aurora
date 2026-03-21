import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeFrequency } from '../lib/frequency';
import { withBase } from '../lib/paths';

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
  url?: string | null;
  frequency: string;
  status: PostStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  submitted_by: string | null;
  serie_data: SerieDataItem[];
}

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
  const [post, setPost] = useState<Post | null>(null);
  const [validations, setValidations] = useState<Validation[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [existingValidation, setExistingValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [validationStatus, setValidationStatus] = useState('');
  const [validationNotes, setValidationNotes] = useState('');

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

  const handleValidationSubmit = async (e: React.FormEvent) => {
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
      <div className="flex justify-center items-center py-16">
        <span className="loading loading-spinner loading-lg" />
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

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm w-full">
      <div className="card-body gap-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="card-title">{post.indicator_id} <p className="text-sm font-light text-base-content/60">Publicación #{post.id.slice(-8)}</p></h2>

          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`badge ${STATUS_BADGE[post.status] ?? 'badge-neutral'}`}>
              {STATUS_LABEL[post.status] ?? post.status}
            </span>
          </div>
        </div>

        {/* Metadata */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
          <div><dt className="text-base-content/60 inline">Fuente: </dt><dd className="inline">{post.data_source || '—'}</dd></div>
          {post.url && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-base-content/60 inline">URL fuente: </dt>
              <dd className="inline break-all">
                <a className="link link-primary" href={post.url} target="_blank" rel="noopener noreferrer">{post.url}</a>
              </dd>
            </div>
          )}
          <div><dt className="text-base-content/60 inline">Frecuencia: </dt><dd className="inline">{post.frequency}</dd></div>
          <div><dt className="text-base-content/60 inline">Creado: </dt><dd className="inline">{new Date(post.created_at).toLocaleString('es-ES')}</dd></div>
          {post.notes && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-base-content/60 inline">Notas: </dt>
              <dd className="inline">{post.notes}</dd>
            </div>
          )}
        </dl>

        {/* Series data */}
        <div className="divider text-sm text-base-content/60 my-1">
          Datos de la serie ({post.serie_data.length} puntos)
        </div>

        {sortedData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th className="w-12 text-center">#</th>
                  <th>Periodo</th>
                  <th className="">Valor reportado</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((d, index) => (
                  <tr key={d.id || String(index)}>
                    <td className="text-center text-base-content/50">{index + 1}</td>
                    <td>{formatSeriesDate(d.date, post.frequency)}</td>
                    <td className=" font-semibold">
                      {new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(d.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-4 text-center text-base-content/50 text-sm">
            Sin datos de serie adjuntos.
          </div>
        )}

        {/* Validaciones para publicaciones no pendientes */}
        {post.status !== 'pending' && validations.length > 0 && (
          <>
            <div className="divider text-sm text-base-content/60 my-1">
              Validaciones ({validations.length})
            </div>
            <ul className="flex flex-col gap-2">
              {validations.map((val) => (
                <li key={val.id} className="flex flex-col gap-1 p-3 rounded-lg border border-base-200 bg-base-50 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`badge badge-sm ${STATUS_BADGE[val.validation_status] ?? 'badge-neutral'}`}>
                      {STATUS_LABEL[val.validation_status] ?? val.validation_status}
                    </span>
                    <span className="text-base-content/50 text-xs">
                      {new Date(val.validated_at).toLocaleString('es-ES')}
                    </span>
                  </div>
                  {val.validation_notes && (
                    <p className="text-base-content/70">{val.validation_notes}</p>
                  )}
                  {!val.validation_notes && (
                    <p className="text-base-content/40 italic">Sin notas.</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Revisión entre pares */}
        {post.status === 'pending' && (
          <>
            <div className="divider my-1">Revisiones</div>

            {!currentUser ? (
              <div role="alert" className="alert alert-warning">
                <span>
                  Por favor{' '}
                  <a href={withBase('/login')} className="link">inicia sesión</a>
                  {' '}para validar esta publicación.
                </span>
              </div>
            ) : null}

            {existingValidation ? (
              <div role="alert" className="alert">
                <div className="flex flex-col gap-1">
                  <span>
                    Ya validaste esta publicación como:{' '}
                    <span className={`badge badge-sm ${STATUS_BADGE[existingValidation.validation_status] ?? 'badge-neutral'}`}>
                      {STATUS_LABEL[existingValidation.validation_status] ?? existingValidation.validation_status}
                    </span>
                  </span>
                  {existingValidation.validation_notes && (
                    <span className="text-sm opacity-70">Notas: {existingValidation.validation_notes}</span>
                  )}
                </div>
              </div>
            ) : null}

            <form onSubmit={handleValidationSubmit} className="w-full max-w-2xl space-y-4">
              <div className="form-control w-full">
                <label className="label pb-2">
                  <span className="label-text font-medium">Decisión de validación <span className="text-error">*</span></span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-box border border-success/40 bg-success/10 p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="validation_status"
                      value="approved"
                      className="radio radio-success"
                      checked={validationStatus === 'approved'}
                      onChange={(e) => setValidationStatus(e.target.value)}
                    />
                    <span className="font-medium text-success">Los datos son correctos y confiables</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-box border border-error/40 bg-error/10 p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="validation_status"
                      value="rejected"
                      className="radio radio-error"
                      checked={validationStatus === 'rejected'}
                      onChange={(e) => setValidationStatus(e.target.value)}
                    />
                    <span className="font-medium text-error">Los datos no son correctos o confiables</span>
                  </label>
                </div>
              </div>

              <div className="form-control w-full">
                <label className="label pb-2">
                  <span className="label-text font-medium">Notas (opcional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  placeholder="Agrega comentarios u observaciones sobre estos datos..."
                  value={validationNotes}
                  onChange={(e) => setValidationNotes(e.target.value)}
                />
              </div>

              {submitResult && (
                <div role="alert" className={`alert ${submitResult.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                  <span>{submitResult.message}</span>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!validationStatus || submitting}
                >
                  {submitting && <span className="loading loading-spinner loading-sm" />}
                  Enviar Revisión
                </button>
              </div>
            </form>

          </>
        )}
      </div>
    </div>
  );
};

export default PostDetail;
