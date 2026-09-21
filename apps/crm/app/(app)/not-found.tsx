import Link from 'next/link';
export default function NotFound() {
  return <div className="empty" style={{ marginTop: 'var(--s-6)' }}><p>No encontramos ese registro.</p><Link className="btn btn-secondary btn-sm" href="/">Ir al tablero</Link></div>;
}
