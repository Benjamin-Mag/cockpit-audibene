import { createPortal } from 'preact/compat';
import { useState } from 'preact/hooks';
import { type AnamField, CONDITIONAL_FIELDS, FIELDS_CATALOG, SITUATION_COMMENT_FIELD, SITUATION_COSI_FIELD } from '../../shared/anamnese-catalog';
import type { AppData } from '../model';
import { Btn, Chip, Field, Icon } from '../components/ui';

type Pair = { label: string; value: string };

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  connected: boolean;
  busy: boolean;
  /** Pied de panneau (hors zone de défilement) où ancrer le bouton Appliquer. */
  footerEl: HTMLElement | null;
  onApply: (picklists: Pair[], texts: Pair[]) => void;
  onEmpty: () => void;
}

const isBinaryOuiNon = (f: AnamField) => f.section === 'Antécédents médicaux' && f.options?.length === 2 && f.options.includes('Oui') && f.options.includes('Non');

export function Anamnese({ data, update, connected, busy, footerEl, onApply, onEmpty }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [phrases, setPhrases] = useState<Record<string, string[]>>({});
  const [cosi, setCosi] = useState<Record<string, number>>({});
  const [free, setFree] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const pick = (label: string, value: string) => {
    const next = { ...picks };
    if (next[label] === value) delete next[label];
    else next[label] = value;
    if (label === "Type d'appareillage") for (const arr of Object.values(CONDITIONAL_FIELDS)) for (const f of arr) delete next[f.label];
    const commentLabel = SITUATION_COMMENT_FIELD[label];
    if (commentLabel) setPhrases((p) => ({ ...p, [commentLabel]: [] }));
    setPicks(next);
  };

  const apply = () => {
    const picklists: Pair[] = Object.entries(picks).map(([label, value]) => ({ label, value }));
    for (const f of FIELDS_CATALOG) if (isBinaryOuiNon(f) && !(f.label in picks)) picklists.push({ label: f.label, value: 'Non' });
    // Un même champ peut recevoir des phrases cochées ET un texte libre : ils sont réunis par « / ».
    const parts: Record<string, string[]> = {};
    for (const [label, list] of Object.entries(phrases)) if (list.length) (parts[label] ??= []).push(...list);
    for (const [label, v] of Object.entries(free)) if (v.trim()) (parts[label] ??= []).push(v.trim());
    const texts: Pair[] = Object.entries(parts).map(([label, list]) => ({ label, value: list.join(' / ') }));
    for (const [label, v] of Object.entries(cosi)) texts.push({ label, value: String(v) });
    const touched = Object.keys(picks).length || texts.length;
    if (!touched) return onEmpty();
    onApply(picklists, texts);
  };

  const reset = () => { setPicks({}); setPhrases({}); setCosi({}); setFree({}); };
  const touched = Object.keys(picks).length + Object.keys(cosi).length + Object.values(phrases).flat().length + Object.values(free).filter((v) => v.trim()).length;

  const chips = (f: AnamField) => (
    <div class="chips">
      {f.options!.map((o) => <Chip key={o} on={picks[f.label] === o} onClick={() => pick(f.label, o)}>{o}</Chip>)}
    </div>
  );

  const stepper = (cosiLabel: string) => {
    const v = cosi[cosiLabel] ?? 1;
    const set = (d: number) => setCosi((c) => ({ ...c, [cosiLabel]: Math.max(1, Math.min(5, v + d)) }));
    return (
      <span class="stepper" title="COSI (intensité 1–5) — envoyé seulement si touché">
        <button type="button" aria-label="COSI moins" onClick={() => set(-1)}><Icon name="minus" size={11} /></button>
        <b style={cosiLabel in cosi ? '' : 'color:var(--faint)'}>{v}</b>
        <button type="button" aria-label="COSI plus" onClick={() => set(1)}><Icon name="plus" size={11} /></button>
      </span>
    );
  };

  const phraseBlock = (situationValue: string, commentLabel: string, withAddRow = true) => {
    const saved = data.anamnese.phrases[situationValue] ?? [];
    const sel = phrases[commentLabel] ?? [];
    const draft = drafts[situationValue] ?? '';
    const add = () => {
      const t = draft.trim();
      if (!t) return;
      update((d) => { const arr = (d.anamnese.phrases[situationValue] ??= []); if (!arr.includes(t)) arr.push(t); });
      setDrafts((x) => ({ ...x, [situationValue]: '' }));
    };
    return (
      <div class="sub">
        {saved.length > 0 && (
          <div class="chips">
            {saved.map((p) => (
              <Chip key={p} small on={sel.includes(p)}
                onClick={() => setPhrases((x) => ({ ...x, [commentLabel]: sel.includes(p) ? sel.filter((s) => s !== p) : [...sel, p] }))}
                onRemove={() => { update((d) => { d.anamnese.phrases[situationValue] = (d.anamnese.phrases[situationValue] ?? []).filter((s) => s !== p); }); setPhrases((x) => ({ ...x, [commentLabel]: sel.filter((s) => s !== p) })); }}>
                {p}
              </Chip>
            ))}
          </div>
        )}
        {withAddRow && (
          <div class="row">
            <input placeholder={`Nouvelle phrase pour « ${situationValue} »…`} value={draft} style="padding:6px 9px;font-size:12px"
              onInput={(e) => setDrafts((x) => ({ ...x, [situationValue]: (e.target as HTMLInputElement).value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            <Btn kind="soft" icon="plus" onClick={add} title="Enregistrer cette phrase" />
          </div>
        )}
      </div>
    );
  };

  /** Texte libre + « + » : le texte tapé devient une puce réutilisable (et reste coché pour cette fiche). */
  const savePhrase = (label: string) => {
    const t = (free[label] ?? '').trim();
    if (!t) return;
    update((d) => { const arr = (d.anamnese.phrases[label] ??= []); if (!arr.includes(t)) arr.push(t); });
    setPhrases((x) => ({ ...x, [label]: [...(x[label] ?? []).filter((s) => s !== t), t] }));
    setFree((x) => ({ ...x, [label]: '' }));
  };

  const renderField = (f: AnamField) => {
    if (f.freeText) {
      return (
        <div key={f.label} class="stack" style="gap:6px">
          <Field label={f.displayLabel ?? f.label}>
            <div class="row">
              <input value={free[f.label] ?? ''} placeholder={f.reusable ? 'Texte du moment…' : '…'}
                onInput={(e) => setFree((x) => ({ ...x, [f.label]: (e.target as HTMLInputElement).value }))}
                onKeyDown={(e) => { if (f.reusable && e.key === 'Enter') { e.preventDefault(); savePhrase(f.label); } }} />
              {f.reusable && <Btn kind="soft" icon="plus" title="Garder ce texte en puce réutilisable" onClick={() => savePhrase(f.label)} disabled={!(free[f.label] ?? '').trim()} />}
            </div>
          </Field>
          {f.reusable && (data.anamnese.phrases[f.label]?.length ?? 0) > 0 && phraseBlock(f.label, f.label, false)}
        </div>
      );
    }
    if (isBinaryOuiNon(f)) {
      const on = picks[f.label] === 'Oui';
      return (
        <label key={f.label} class="checkrow">
          <span class="label">{f.displayLabel ?? f.label}</span>
          <input type="checkbox" checked={on} onChange={() => setPicks((p) => ({ ...p, [f.label]: on ? 'Non' : 'Oui' }))} />
        </label>
      );
    }
    if (f.label === "Type d'appareillage") {
      const cond = picks[f.label] ? CONDITIONAL_FIELDS[picks[f.label]] ?? [] : [];
      return (
        <div key={f.label} class="stack">
          <Field label={f.label}>{chips(f)}</Field>
          {cond.length > 0 && <div class="sub">{cond.map(renderField)}</div>}
        </div>
      );
    }
    const commentLabel = SITUATION_COMMENT_FIELD[f.label];
    if (commentLabel) {
      return (
        <div key={f.label} class="stack">
          <Field label={f.displayLabel ?? f.label} right={stepper(SITUATION_COSI_FIELD[f.label])}>{chips(f)}</Field>
          {picks[f.label] && phraseBlock(picks[f.label], commentLabel)}
        </div>
      );
    }
    return <Field key={f.label} label={f.displayLabel ?? f.label}>{chips(f)}</Field>;
  };

  let lastSection = '';
  const rows: preact.JSX.Element[] = [];
  for (const f of FIELDS_CATALOG) {
    if (f.section !== lastSection) { lastSection = f.section; rows.push(<div key={'s:' + f.section} class="section-title">{f.section}</div>); }
    rows.push(renderField(f));
  }

  const footer = (
    <div class="row">
      <Btn big icon="check" busy={busy} disabled={!connected} onClick={apply} class="grow">
        Appliquer{touched ? ` (${touched})` : ''}
      </Btn>
      {touched > 0 && <Btn kind="ghost" icon="x" title="Tout effacer" onClick={reset} />}
    </div>
  );

  return (
    <div class="view">
      {!connected && <div class="note">Ouvre une Piste Salesforce (onglet Anamnèse de la fiche) pour appliquer les choix COSI.</div>}
      {rows}
      {footerEl && createPortal(footer, footerEl)}
    </div>
  );
}
