import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Fiche, Genre } from '../../shared/types';
import { writeClipboard } from '../bridge';
import { Btn, Chip, Field, Icon, Seg } from '../components/ui';
import { frToIso, frToTime, isDateVar, isHeureVar, isoToFr, timeToFr } from '../dates';
import { type AppData, CATEGORIES_PARTENAIRE, CATEGORIES_PATIENT, type Template, fillVars, resolveGenre, systemValues, uid } from '../model';

type Audience = 'patient' | 'partenaire';
const SYSTEM_VARS = ['nom_conseiller', 'tel_conseiller', 'titre_conseiller'];
const FIELD_LABELS: Record<string, string> = { nom: 'Nom du patient', heure: 'Heure du RDV', date: 'Date du RDV', 'nom partenaire': 'Nom du partenaire', adresse: 'Adresse du partenaire' };

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  fiche: Fiche | null;
  connected: boolean;
  busy: boolean;
  onInsert: (subject: string, body: string) => void;
  onNeedPartner: () => Promise<Fiche | null>;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

function extractVars(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

const fieldLabel = (v: string) => FIELD_LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');

export function Mails({ data, update, fiche, connected, busy, onInsert, onNeedPartner, toast }: Props) {
  const [audience, setAudience] = useState<Audience>('patient');
  const [cat, setCat] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [genre, setGenre] = useState<Genre>(null);
  const [manualBody, setManualBody] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);

  const effectiveGenre = genre ?? fiche?.genre ?? null;
  const categories = audience === 'patient' ? [...CATEGORIES_PATIENT, ...data.categories.patient] : [...CATEGORIES_PARTENAIRE, ...data.categories.partenaire];
  const templates = data.templates.filter((t) => t.audience === audience && (!cat || (audience === 'patient' ? t.patientCategory === 'all' || t.patientCategory === cat : t.partnerCategory === cat)));
  const sel = data.templates.find((t) => t.id === selId) ?? null;

  const vars = useMemo(() => {
    if (!sel) return [];
    let v = extractVars(`${sel.subject ?? ''} ${sel.body} ${sel.smsCompanion ?? ''}`).filter((x) => !SYSTEM_VARS.includes(x));
    // Ordre de saisie : nom d'abord, puis la date suivie immédiatement de l'heure, puis le reste.
    const heures = v.filter(isHeureVar);
    v = v.filter((x) => !isHeureVar(x));
    const di = v.findIndex(isDateVar);
    if (di !== -1) v.splice(di + 1, 0, ...(heures.length ? heures : ['heure']));
    if (v.includes('nom')) v = ['nom', ...v.filter((x) => x !== 'nom')];
    return v;
  }, [sel]);

  // Préremplissage depuis la fiche (le partenaire/adresse demandent une lecture plus longue : à la demande).
  const auto: Record<string, string> = {
    nom: fiche ? [fiche.prenom, fiche.nom].filter(Boolean).join(' ') : '',
    'nom partenaire': fiche?.partenaire ?? '',
    adresse: fiche?.adresse ?? '',
  };
  const needsPartner = vars.includes('adresse') || vars.includes('nom partenaire');
  useEffect(() => {
    if (!sel || !needsPartner || !fiche || (fiche.adresse && fiche.partenaire) || partnerLoading) return;
    setPartnerLoading(true);
    onNeedPartner().finally(() => setPartnerLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id, fiche?.recordId, needsPartner]);

  const val = (v: string) => values[v] ?? auto[v] ?? '';
  const civ = effectiveGenre === 'F' ? 'Madame' : effectiveGenre === 'M' ? 'Monsieur' : '';
  const composeValues = () => {
    const out: Record<string, string> = { ...systemValues(data.reglages) };
    for (const v of vars) out[v] = val(v);
    const nom = val('nom').trim();
    out.nom = nom ? (civ ? `${civ} ${nom}` : nom) : '';
    out.adresse = val('adresse').trim() ? `\n${val('adresse').trim()}\n` : '';
    return out;
  };
  const compose = (text: string) => resolveGenre(fillVars(text, composeValues()), effectiveGenre);
  const subject = sel?.type === 'email' && sel.subject ? compose(sel.subject) : '';
  const body = sel ? manualBody ?? compose(sel.body) : '';
  const sms = sel?.audience === 'patient' && sel.type === 'email' && sel.smsCompanion ? compose(sel.smsCompanion) : sel?.type === 'sms' ? body : '';

  const select = (id: string) => { setSelId(id); setListOpen(false); setValues({}); setManualBody(null); };
  const markup = (text: string) => text.split(/(\{\{[^}]+\}\})/g).map((part, i) => (/^\{\{/.test(part) ? <mark key={i}>{part}</mark> : part));

  const copy = async (text: string, what: string) => toast((await writeClipboard(text)) ? `${what} copié` : 'Copie impossible', 'ok');

  // ---------------------------------------------------------------- éditeur de modèle
  if (editing) {
    const e = editing;
    const set = (patch: Partial<Template>) => setEditing({ ...e, ...patch });
    const cats = e.audience === 'patient' ? [{ id: 'all', label: 'Toutes' }, ...CATEGORIES_PATIENT, ...data.categories.patient] : [...CATEGORIES_PARTENAIRE, ...data.categories.partenaire];
    const catVal = e.audience === 'patient' ? e.patientCategory ?? 'all' : e.partnerCategory ?? 'CC1';
    const isNew = !data.templates.some((t) => t.id === e.id);
    const saveTpl = () => {
      if (!e.title.trim() || !e.body.trim()) { toast('Titre et texte obligatoires', 'err'); return; }
      update((d) => { const i = d.templates.findIndex((t) => t.id === e.id); if (i === -1) d.templates.push({ ...e, createdAt: Date.now() }); else d.templates[i] = e; });
      setEditing(null);
      setSelId(e.id);
      setAudience(e.audience);
      setListOpen(false);
      toast('Modèle enregistré', 'ok');
    };
    return (
      <div class="view">
        <div class="row" style="justify-content:space-between">
          <span class="label">{isNew ? 'Nouveau modèle' : 'Modifier le modèle'}</span>
          <Btn kind="ghost" icon="x" onClick={() => setEditing(null)} title="Annuler" />
        </div>
        <Field label="Titre"><input value={e.title} onInput={(ev) => set({ title: (ev.target as HTMLInputElement).value })} placeholder="Ex. Confirmation de rendez-vous" /></Field>
        <div class="row wrap">
          <Seg options={[{ id: 'patient', label: 'Patient' }, { id: 'partenaire', label: 'Partenaire' }]} value={e.audience} onChange={(a) => set({ audience: a, patientCategory: a === 'patient' ? 'all' : undefined, partnerCategory: a === 'partenaire' ? 'CC1' : undefined })} />
          <Seg options={[{ id: 'email', label: 'E-mail' }, { id: 'sms', label: 'SMS' }]} value={e.type} onChange={(t) => set({ type: t })} />
        </div>
        <Field label="Catégorie">
          <div class="chips">{cats.map((c) => <Chip key={c.id} small on={catVal === c.id} onClick={() => set(e.audience === 'patient' ? { patientCategory: c.id } : { partnerCategory: c.id })}>{c.label}</Chip>)}</div>
        </Field>
        {e.type === 'email' && <Field label="Objet"><input value={e.subject ?? ''} onInput={(ev) => set({ subject: (ev.target as HTMLInputElement).value })} placeholder="Objet du mail" /></Field>}
        <Field label={e.type === 'email' ? 'Texte du mail' : 'Texte du SMS'}>
          <textarea rows={10} value={e.body} onInput={(ev) => set({ body: (ev.target as HTMLTextAreaElement).value })} />
        </Field>
        {e.audience === 'patient' && e.type === 'email' && (
          <Field label="SMS accompagnateur (optionnel)"><textarea rows={5} value={e.smsCompanion ?? ''} onInput={(ev) => set({ smsCompanion: (ev.target as HTMLTextAreaElement).value })} /></Field>
        )}
        <div class="note">Variables : {'{{nom}}'}, {'{{date}}'}, {'{{heure}}'}, {'{{nom partenaire}}'}, {'{{adresse}}'}, {'{{nom_conseiller}}'}, {'{{tel_conseiller}}'}, {'{{titre_conseiller}}'} — et patient(e), il(elle), conseiller(ère) s'accordent au genre.</div>
        <div class="row">
          <Btn icon="check" onClick={saveTpl} class="grow">Enregistrer le modèle</Btn>
          {!isNew && <Btn kind="danger" icon="x" title="Supprimer ce modèle" onClick={() => { if (confirm(`Supprimer « ${e.title} » ?`)) { update((d) => { d.templates = d.templates.filter((t) => t.id !== e.id); }); setEditing(null); setSelId(null); setListOpen(true); } }} />}
        </div>
      </div>
    );
  }

  const newTemplate = () => {
    const sig = audience === 'partenaire' ? data.reglages.sigPartenaireMail : data.reglages.sigPatientMail;
    setEditing({ id: uid('tpl'), title: '', audience, type: 'email', patientCategory: audience === 'patient' ? 'all' : undefined, partnerCategory: audience === 'partenaire' ? 'CC1' : undefined, subject: '', body: sig ? '\n' + fillVars(sig, systemValues(data.reglages)) : '', smsCompanion: audience === 'patient' && data.reglages.sigPatientSMS ? '\n' + fillVars(data.reglages.sigPatientSMS, systemValues(data.reglages)) : '' });
  };

  // ---------------------------------------------------------------- vue principale
  return (
    <div class="view">
      <div class="row" style="justify-content:space-between">
        <Seg options={[{ id: 'patient', label: 'Patient' }, { id: 'partenaire', label: 'Partenaire' }]} value={audience} onChange={(a) => { setAudience(a); setCat(null); setSelId(null); setListOpen(true); }} />
        <Btn kind="soft" icon="plus" onClick={newTemplate} title="Nouveau modèle" />
      </div>

      {(listOpen || !sel) ? (
        <>
          <div class="chips">
            <Chip small on={cat === null} onClick={() => setCat(null)}>Tous</Chip>
            {categories.map((c) => <Chip key={c.id} small on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.label}</Chip>)}
          </div>
          {templates.length === 0 ? (
            <div class="empty"><div class="ico"><Icon name="mail" size={26} /></div>Aucun modèle {audience === 'patient' ? 'patient' : 'partenaire'}{cat ? ` en ${cat}` : ''}.<br /><span class="note">Le + en haut à droite en crée un, ou importe ton data.json dans Réglages.</span></div>
          ) : (
            <div class="tpl-list">
              {templates.map((t) => (
                <button key={t.id} type="button" class={['tpl', t.id === selId ? 'on' : ''].join(' ')} onClick={() => select(t.id)}>
                  <span class="t">{t.title}</span>
                  <span class={['badge', t.type === 'sms' ? 'sms' : ''].join(' ')}>{t.type === 'sms' ? 'SMS' : t.smsCompanion ? 'E-mail + SMS' : 'E-mail'}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <button type="button" class="tpl on" onClick={() => setListOpen(true)} title="Changer de modèle">
          <span class="t">{sel!.title}</span>
          <span class="badge">changer</span>
        </button>
      )}

      {sel && !listOpen && (
        <>
          <div class="card" style="animation:none">
            <div class="stack">
              <div class="row wrap" style="justify-content:space-between">
                <Seg options={[{ id: 'M', label: 'M.' }, { id: 'F', label: 'Mme' }]} value={effectiveGenre} onChange={setGenre} />
                <Btn kind="ghost" icon="pen" title="Modifier ce modèle" onClick={() => setEditing({ ...sel })} />
              </div>
              {vars.map((v) => {
                const fromFiche = v in auto && !(v in values) && !!auto[v];
                if (isDateVar(v)) {
                  return (
                    <Field key={v} label={fieldLabel(v)}>
                      <input type="date" value={frToIso(val(v))} onInput={(e) => setValues((x) => ({ ...x, [v]: isoToFr((e.target as HTMLInputElement).value) }))} />
                    </Field>
                  );
                }
                if (isHeureVar(v)) {
                  return (
                    <Field key={v} label={fieldLabel(v)}>
                      <input type="time" value={frToTime(val(v))} onInput={(e) => setValues((x) => ({ ...x, [v]: timeToFr((e.target as HTMLInputElement).value) }))} />
                    </Field>
                  );
                }
                const loading = partnerLoading && (v === 'adresse' || v === 'nom partenaire') && !val(v);
                return (
                  <Field key={v} label={fieldLabel(v)} right={fromFiche ? <span class="note">depuis la fiche</span> : loading ? <span class="note">lecture…</span> : undefined}>
                    {v === 'adresse'
                      ? <textarea rows={2} value={val(v)} onInput={(e) => setValues((x) => ({ ...x, [v]: (e.target as HTMLTextAreaElement).value }))} />
                      : <input value={val(v)} placeholder={fieldLabel(v)} onInput={(e) => setValues((x) => ({ ...x, [v]: (e.target as HTMLInputElement).value }))} />}
                  </Field>
                );
              })}
            </div>
          </div>

          {manualBody === null ? (
            <div class="preview" onDblClick={() => setManualBody(body)} title="Double-clic pour modifier le texte">
              {subject && <div class="subj">{markup(subject)}</div>}
              {markup(body)}
            </div>
          ) : (
            <div class="stack">
              {subject && <div class="preview"><div class="subj">{subject}</div></div>}
              <textarea rows={12} value={manualBody} onInput={(e) => setManualBody((e.target as HTMLTextAreaElement).value)} />
              <div class="row"><span class="note grow">Texte modifié à la main</span><Btn kind="ghost" icon="refresh" onClick={() => setManualBody(null)}>Revenir au modèle</Btn></div>
            </div>
          )}

          {sel.type === 'email' ? (
            <div class="row">
              <Btn big icon="send" busy={busy} disabled={!connected} onClick={() => onInsert(subject, body)} class="grow" title="Ouvre le composeur Salesforce et y met l'objet, le logo, le texte et le pied de page">
                Insérer dans Salesforce
              </Btn>
              <Btn kind="ghost" icon="copy" title="Copier (objet + texte)" onClick={() => copy(subject ? `${subject}\n${body}` : body, 'Message')} />
            </div>
          ) : (
            <Btn big icon="copy" onClick={() => copy(body, 'SMS')}>Copier le SMS</Btn>
          )}
          {sms && sel.type === 'email' && (
            <div class="stack" style="gap:6px">
              <div class="preview" style="font-size:12.3px">{markup(sms)}</div>
              <Btn kind="soft" icon="copy" onClick={() => copy(sms, 'SMS')}>Copier le SMS</Btn>
            </div>
          )}
          {!connected && sel.type === 'email' && <div class="note">Ouvre une fiche Salesforce pour insérer directement dans le composeur ; sinon Copier puis coller.</div>}
        </>
      )}
    </div>
  );
}
