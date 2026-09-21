import Link from 'next/link';
import { Badge } from '@ti24/ui';
import { LEAD_STATUS, PROPOSAL_STATUS, SERVICE_LABEL, STAGE_TONE, stageLabel, ACTIVITY_KIND, fmtDateTime } from '@/lib/format';
import { activityAction, taskAction, completeTaskAction } from '@/lib/actions';

export const LeadBadge = ({ s }: { s: string }) => <Badge tone={LEAD_STATUS[s]?.tone}>{LEAD_STATUS[s]?.label ?? s}</Badge>;
export const StageBadge = ({ s }: { s: string }) => <Badge tone={STAGE_TONE[s]}>{stageLabel(s)}</Badge>;
export const ProposalBadge = ({ s }: { s: string }) => <Badge tone={PROPOSAL_STATUS[s]?.tone}>{PROPOSAL_STATUS[s]?.label ?? s}</Badge>;
export const ServiceTags = ({ codes }: { codes: string[] }) => (
  <span className="row" style={{ gap: 4 }}>{codes.map((c) => <span key={c} className="tag" title={SERVICE_LABEL[c] ?? c}>{c}</span>)}</span>
);
export const DemoTag = ({ on }: { on: boolean }) => (on ? <span className="env-demo" title="Registro de demostración">DEMO</span> : null);

type Target = { leadId?: string; accountId?: string; opportunityId?: string };

export function ActivityForm({ target, back }: { target: Target; back: string }) {
  return (
    <form action={activityAction} className="form-grid">
      <input type="hidden" name="back" value={back} />
      {target.leadId ? <input type="hidden" name="lead_id" value={target.leadId} /> : null}
      {target.accountId ? <input type="hidden" name="account_id" value={target.accountId} /> : null}
      {target.opportunityId ? <input type="hidden" name="opportunity_id" value={target.opportunityId} /> : null}
      <div className="inline-form">
        <div className="field" style={{ width: 140 }}>
          <label htmlFor="act-kind">Tipo</label>
          <select id="act-kind" name="kind" className="select" defaultValue="call">
            {Object.entries(ACTIVITY_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="act-subject">Asunto</label>
          <input id="act-subject" name="subject" className="input" required minLength={2} maxLength={200} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="act-body">Notas (opcional)</label>
        <textarea id="act-body" name="body" className="textarea" style={{ minHeight: 72 }} maxLength={4000} />
      </div>
      <div><button className="btn btn-secondary btn-sm" type="submit">Registrar actividad</button></div>
    </form>
  );
}

export function ActivityList({ items }: { items: { id: string; kind: string; subject: string; body: string | null; occurred_at: Date; author: string | null }[] }) {
  if (!items.length) return <p className="empty">Sin actividades todavía.</p>;
  return (
    <ul className="timeline">
      {items.map((a) => (
        <li key={a.id}>
          <strong>{ACTIVITY_KIND[a.kind] ?? a.kind}:</strong> {a.subject}
          <div className="muted xs">{fmtDateTime(a.occurred_at)} · {a.author ?? 'Sistema'}</div>
          {a.body ? <p className="small" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{a.body}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function TaskForm({ target, back }: { target: { leadId?: string; opportunityId?: string }; back: string }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return (
    <form action={taskAction} className="inline-form">
      <input type="hidden" name="back" value={back} />
      {target.leadId ? <input type="hidden" name="lead_id" value={target.leadId} /> : null}
      {target.opportunityId ? <input type="hidden" name="opportunity_id" value={target.opportunityId} /> : null}
      <div className="field" style={{ flex: 1, minWidth: 180 }}>
        <label htmlFor="task-title">Nueva tarea</label>
        <input id="task-title" name="title" className="input" required minLength={2} maxLength={200} placeholder="Ej. Enviar propuesta" />
      </div>
      <div className="field" style={{ width: 160 }}>
        <label htmlFor="task-due">Vence</label>
        <input id="task-due" name="due_at" type="date" className="input" required defaultValue={tomorrow} />
      </div>
      <button className="btn btn-secondary btn-sm" type="submit">Agregar</button>
    </form>
  );
}

export function TaskList({ items, back }: { items: { id: string; title: string; due_at: Date; done_at: Date | null; assignee: string | null; context?: string | null; lead_id?: string | null; opportunity_id?: string | null }[]; back: string }) {
  if (!items.length) return <p className="empty">Sin tareas.</p>;
  const now = Date.now();
  return (
    <ul className="timeline">
      {items.map((t) => (
        <li key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <span style={t.done_at ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{t.title}</span>
            {t.context ? <> · <Link href={t.opportunity_id ? `/oportunidades/${t.opportunity_id}` : `/leads/${t.lead_id}`} className="small">{t.context}</Link></> : null}
            <div className="xs" style={{ color: !t.done_at && new Date(t.due_at).getTime() < now ? 'var(--danger)' : 'var(--muted)' }}>
              {t.done_at ? `Hecha ${fmtDateTime(t.done_at)}` : `Vence ${fmtDateTime(t.due_at)}`} · {t.assignee ?? '—'}
            </div>
          </div>
          {!t.done_at ? (
            <form action={completeTaskAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="back" value={back} />
              <button className="btn btn-ghost btn-sm" type="submit">Hecha<span className="sr-only">: {t.title}</span></button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
