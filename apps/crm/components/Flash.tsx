export function Flash({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) return <p className="notice notice-danger" role="alert" style={{ marginBottom: 'var(--s-4)' }}>{error}</p>;
  if (ok) return <p className="notice notice-ok" role="status" style={{ marginBottom: 'var(--s-4)' }}>{ok}</p>;
  return null;
}
