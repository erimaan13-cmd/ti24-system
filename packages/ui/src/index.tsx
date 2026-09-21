/**
 * Componentes base de TI24 (web + CRM). Son envoltorios finos sobre las clases de styles.css,
 * así web y CRM comparten exactamente el mismo aspecto sin librerías extra.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' }) {
  return <button className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)} {...props} />;
}

export function ButtonLink({ variant = 'primary', size, className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: 'sm' }) {
  return <a className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)} {...props} />;
}

/** Logotipo provisional «TI24»: «TI» tinta + «24» ámbar (AT-12 §6). Es SVG con nombre accesible. */
export function WordmarkSvg({ height = 22 }: { height?: number }) {
  return (
    <svg className="wordmark-svg" viewBox="0 0 60 26" height={height} width={(height * 60) / 26} role="img" aria-label="TI24" focusable="false">
      <text x="0" y="20" fontSize="22" fontWeight="700" letterSpacing="-1" fill="currentColor" fontFamily="var(--font-sans)">TI</text>
      <text x="25" y="20" fontSize="21" fontWeight="600" fill="#E3A21A" fontFamily="var(--font-mono)">24</text>
    </svg>
  );
}

export function Wordmark({ href = '/', label = 'TI24, inicio' }: { href?: string; label?: string }) {
  return (
    <a className="wordmark" href={href} aria-label={label}>
      <WordmarkSvg />
    </a>
  );
}

export function Badge({ tone, children }: { tone?: 'amber' | 'ok' | 'danger' | 'info'; children: ReactNode }) {
  return <span className={cx('badge', tone && `badge-${tone}`)}>{children}</span>;
}

export function Card({ tight, className, ...props }: HTMLAttributes<HTMLDivElement> & { tight?: boolean }) {
  return <div className={cx('card', tight && 'card-tight', className)} {...props} />;
}

export function Field({ id, label, hint, error, children }: { id: string; label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error ? <span className="hint" id={`${id}-hint`}>{hint}</span> : null}
      {error ? <span className="error" id={`${id}-error`} role="alert">{error}</span> : null}
    </div>
  );
}

export function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="kpi card card-tight">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {note ? <span className="kpi-note">{note}</span> : null}
    </div>
  );
}

export const tokens = {
  ink: '#111214',
  paper: '#FAFAF7',
  amber: '#E3A21A',
  amberInk: '#7A5200',
  muted: '#5E5B55',
  line: '#E4E2DC',
} as const;
