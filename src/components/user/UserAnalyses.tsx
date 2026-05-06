import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { withBase } from "../../lib/paths";

const UserAnalyses = () => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const idFromUrl = new URLSearchParams(typeof window !== "undefined" ? window.location.search : '').get('userId');
    setUserId(idFromUrl);
  }, []);

  useEffect(() => {
    if (!userId) {
      setAnalyses([]);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("analysis")
        .select(
          "id, title, description, created_at, updated_at, status",
        )
        .eq("created_by", userId)
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) setError(error.message);
      else setAnalyses(data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false };
  }, [userId]);

  if (loading) return (
    <div className="flex items-center gap-3 text-base-content/70" aria-live="polite">
      <span className="loading loading-spinner loading-md" aria-hidden="true"></span>
      <p>Cargando análisis…</p>
    </div>
  );
  if (!userId) {
    return <div className="alert alert-warning">No se detectó el usuario (userId).</div>;
  }
  if (error) {
    return (
      <div className="alert alert-error" role="alert" aria-live="polite">
        <span>Error al cargar análisis: {error}.</span>
      </div>
    );
  }
  if (!analyses || analyses.length === 0) {
    return <p className="text-gray-600">No tienes análisis registrados.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-600">Total: <strong>{analyses.length}</strong></p>
      <div className="grid gap-4">
        {analyses.map(a => (
          <a key={a.id} href={withBase(`/analisis?id=${a.id}`)} className="block card border border-base-300 bg-base-100 shadow-sm hover:shadow ring-1 ring-inset ring-base-200/10 transition">
            <div className="card-body py-4 gap-2">
              <div className="font-semibold text-base flex items-center gap-2">
                {a.title || <span className="italic text-base-content/50">Sin título</span>}
                {a.status === 'public' ? (
                  <span className="badge badge-xs badge-success capitalize">Público</span>
                ) : a.status === 'draft' ? (
                  <span className="text-xs text-base-content/40">Borrador</span>
                ) : a.status === 'hidden' ? (
                  <span className="text-xs text-base-content/40">Oculto</span>
                ) : null}
              </div>
              {a.description && <div className="text-sm text-base-content/60 line-clamp-2">{a.description}</div>}
              <div className="text-xs mt-2 flex gap-2 text-base-content/40">
                <span>Creado: {new Date(a.created_at).toLocaleString("es-ES")}</span>
                <span>·</span>
                <span>ID: <code>{a.id}</code></span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default UserAnalyses;
