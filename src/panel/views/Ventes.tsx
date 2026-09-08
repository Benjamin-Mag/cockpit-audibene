import { useState } from 'preact/hooks';
import { Btn, Chip, Field, Icon, Seg } from '../components/ui';
import type { AppData, Payslip } from '../model';
import { computeMonth, computeRates, euro, euro2, listMonths, monthKey, monthLabel, monthShort, pct } from '../ventes';

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  /** Vente proposée depuis la fiche Salesforce ouverte (Opportunité). */
  prefill: { name: string; url: string } | null;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

type Section = 'mois' | 'annee' | 'paie' | 'params';

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? 0 : n; };

export function Ventes({ data, update, prefill, toast }: Props) {
  const v = data.ventes;
  const months = listMonths(v);
  const current = monthKey(new Date());
  const [month, setMonth] = useState(current);
  const [section, setSection] = useState<Section>('mois');
  const [name, setName] = useState(prefill?.name ?? '');
  const [url, setUrl] = useState(prefill?.url ?? '');
  const [cat, setCat] = useState<1 | 2>(2);
  const [slip, setSlip] = useState<Partial<Payslip>>({ ficheMonth: monthLabel(current), includeInAverage: true });

  const m = computeMonth(v, month);
  const rates = computeRates(v);
  const sales = v.sales[month] ?? [];

  const addSale = () => {
    const n = name.trim();
    if (!n) return;
    update((d) => { (d.ventes.sales[month] ??= []).push({ name: n, cat, ...(url.trim() ? { url: url.trim() } : {}) }); });
    setName(''); setUrl('');
    toast(`Vente ajoutée : ${n} (CAT ${cat})`, 'ok');
  };

  const setSetting = (k: keyof AppData['ventes']['settings'], val: string) => update((d) => { d.ventes.settings[k] = num(val); });

  const yearRows = months.filter((k) => k.endsWith(month.slice(-2))).map((k) => ({ key: k, ...computeMonth(v, k) }));
  const yearTotal = yearRows.reduce((a, r) => ({ total: a.total + r.total, prime: a.prime + r.totalPrime, c1: a.c1 + r.count1, c2: a.c2 + r.count2 }), { total: 0, prime: 0, c1: 0, c2: 0 });
  const maxPrime = Math.max(1, ...yearRows.map((r) => r.totalPrime));

  const addSlip = () => {
    const s = slip;
    if (!s.ficheMonth || !s.brut) { toast('Mois et brut obligatoires', 'err'); return; }
    const full: Payslip = {
      ficheMonth: s.ficheMonth, brut: s.brut ?? 0, primes: s.primes ?? 0, cotisations: s.cotisations ?? 0, indemnites: s.indemnites ?? 0,
      autresRetenues: s.autresRetenues ?? 0, prelevementSource: s.prelevementSource ?? 0, netAvantImpot: s.netAvantImpot ?? 0, netApayer: s.netApayer ?? 0,
      netSocial: s.netSocial ?? 0, includeInAverage: s.includeInAverage !== false,
    };
    update((d) => { d.ventes.payslips.push(full); });
    setSlip({ ficheMonth: '', includeInAverage: true });
    toast('Fiche de paie ajoutée', 'ok');
  };
  const slipField = (k: keyof Payslip, label: string) => (
    <Field label={label}>
      <input inputMode="decimal" value={slip[k] === undefined ? '' : String(slip[k])} placeholder="0" onInput={(e) => setSlip((x) => ({ ...x, [k]: num((e.target as HTMLInputElement).value) }))} />
    </Field>
  );

  return (
    <div class="view">
      <Seg options={[{ id: 'mois', label: 'Mois' }, { id: 'annee', label: 'Année' }, { id: 'paie', label: 'Paie' }, { id: 'params', label: 'Primes' }]} value={section} onChange={setSection} />

      {section === 'mois' && (
        <>
          <div class="chips">
            {months.slice(-6).map((k) => <Chip key={k} small on={month === k} onClick={() => setMonth(k)}>{monthShort(k)}</Chip>)}
          </div>
          <div class="card" style="animation:none">
            <div class="stack" style="gap:6px">
              <div class="label">{monthLabel(month)}</div>
              <div class="kv"><span>Ventes</span><span><b>{m.total}</b> · {m.count1} CAT 1 · {m.count2} CAT 2</span></div>
              <div class="kv"><span>Primes</span><span><b>{euro(m.totalPrime)}</b></span></div>
              <div class="kv"><span>Net estimé après impôt</span><span><b>{euro(m.netApresImpot)}</b></span></div>
              <div class="note">Brut {euro(m.brut)} · net avant impôt {euro(m.netAvantImpot)} · taux {rates.fromPayslips ? `moyens de ${rates.fromPayslips} fiche(s)` : 'par défaut'}</div>
            </div>
          </div>

          <div class="card" style="animation:none">
            <div class="stack">
              <div class="label">Ajouter une vente</div>
              <input placeholder="Client (ex. Marie Dupont)" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') addSale(); }} />
              <input placeholder="Lien Salesforce (optionnel)" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} style="font-size:12px" />
              <div class="row">
                <Seg options={[{ id: '1', label: `CAT 1 · ${euro(v.settings.primeCat1)}` }, { id: '2', label: `CAT 2 · ${euro(v.settings.primeCat2)}` }]} value={String(cat)} onChange={(c) => setCat(c === '1' ? 1 : 2)} />
              </div>
              <Btn icon="plus" onClick={addSale} disabled={!name.trim()}>Ajouter à {monthShort(month)}</Btn>
              {prefill && name !== prefill.name && <Btn kind="ghost" onClick={() => { setName(prefill.name); setUrl(prefill.url); }}>Reprendre la fiche ouverte : {prefill.name}</Btn>}
            </div>
          </div>

          {sales.length === 0 ? <div class="empty">Aucune vente en {monthLabel(month).toLowerCase()}.</div> : (
            <div class="tpl-list">
              {sales.map((s, i) => (
                <div key={i} class="tpl" style="cursor:default">
                  <span class="t" style="font-weight:400">{s.name}</span>
                  <span class={['badge', s.cat === 2 ? 'sms' : ''].join(' ')}>CAT {s.cat}</span>
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer" title="Ouvrir dans Salesforce" style="color:var(--accent);display:inline-flex"><Icon name="send" size={13} /></a>}
                  <button type="button" class="btn ghost icon" title="Supprimer" onClick={() => { if (confirm(`Supprimer la vente « ${s.name} » ?`)) update((d) => { d.ventes.sales[month].splice(i, 1); }); }}><Icon name="x" size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {section === 'annee' && (
        <>
          <div class="card" style="animation:none">
            <div class="stack" style="gap:6px">
              <div class="label">Année 20{month.slice(-2)}</div>
              <div class="kv"><span>Ventes</span><span><b>{yearTotal.total}</b> · {yearTotal.c1} CAT 1 · {yearTotal.c2} CAT 2</span></div>
              <div class="kv"><span>Primes cumulées</span><span><b>{euro(yearTotal.prime)}</b></span></div>
              <div class="kv"><span>Moyenne / mois</span><span>{euro(yearRows.length ? yearTotal.prime / yearRows.length : 0)}</span></div>
            </div>
          </div>
          <div class="stack" style="gap:6px">
            {yearRows.map((r) => (
              <div key={r.key} class="row" style="gap:8px;font-size:12.3px">
                <span style="width:44px;color:var(--muted)">{monthShort(r.key)}</span>
                <div class="grow" style="height:10px;border-radius:5px;background:var(--surface-2);overflow:hidden">
                  <div style={`height:100%;width:${Math.round((r.totalPrime / maxPrime) * 100)}%;background:var(--accent);border-radius:5px;transition:width var(--dur-slow) var(--ease)`} />
                </div>
                <span style="width:64px;text-align:right;font-weight:600">{euro(r.totalPrime)}</span>
                <span style="width:26px;text-align:right;color:var(--muted)">{r.total}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {section === 'paie' && (
        <>
          <div class="note">Les fiches servent à calculer les taux moyens (cotisations {pct(rates.cot)}, retenues {euro2(rates.retenues)}, prélèvement {pct(rates.pas)}). Décoche une fiche atypique pour l'exclure des moyennes.</div>
          {v.payslips.length > 0 && (
            <div class="tpl-list">
              {v.payslips.map((p, i) => (
                <div key={i} class="tpl" style="cursor:default;flex-wrap:wrap">
                  <span class="t">{p.ficheMonth}</span>
                  <span class="note">brut {euro(p.brut)} · net {euro(p.netApayer)}</span>
                  <label class="row" style="gap:4px;font-size:11px;color:var(--muted)" title="Inclure dans les moyennes">
                    <input type="checkbox" checked={p.includeInAverage !== false} onChange={(e) => update((d) => { d.ventes.payslips[i].includeInAverage = (e.target as HTMLInputElement).checked; })} style="width:14px;height:14px;margin:0" /> moy.
                  </label>
                  <button type="button" class="btn ghost icon" title="Supprimer" onClick={() => { if (confirm(`Supprimer la fiche ${p.ficheMonth} ?`)) update((d) => { d.ventes.payslips.splice(i, 1); }); }}><Icon name="x" size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div class="card" style="animation:none">
            <div class="stack">
              <div class="label">Ajouter une fiche de paie</div>
              <Field label="Mois de la fiche"><input value={slip.ficheMonth ?? ''} placeholder="Septembre 2026" onInput={(e) => setSlip((x) => ({ ...x, ficheMonth: (e.target as HTMLInputElement).value }))} /></Field>
              <div class="grid2">
                {slipField('brut', 'Brut')}
                {slipField('primes', 'Dont primes')}
                {slipField('cotisations', 'Cotisations')}
                {slipField('autresRetenues', 'Autres retenues')}
                {slipField('prelevementSource', 'Prélèvement à la source')}
                {slipField('netApayer', 'Net à payer')}
              </div>
              <Btn icon="plus" onClick={addSlip}>Ajouter la fiche</Btn>
              <div class="note">L'import automatique du PDF de la fiche arrivera dans une prochaine version ; l'export de l'ancien suivi (avec ses fiches) s'importe dans Réglages.</div>
            </div>
          </div>
        </>
      )}

      {section === 'params' && (
        <div class="stack">
          <div class="grid2">
            <Field label="Prime CAT 1 (€)"><input inputMode="decimal" value={v.settings.primeCat1} onInput={(e) => setSetting('primeCat1', (e.target as HTMLInputElement).value)} /></Field>
            <Field label="Prime CAT 2 (€)"><input inputMode="decimal" value={v.settings.primeCat2} onInput={(e) => setSetting('primeCat2', (e.target as HTMLInputElement).value)} /></Field>
            <Field label="Salaire de base brut (€)"><input inputMode="decimal" value={v.settings.salaireBase} onInput={(e) => setSetting('salaireBase', (e.target as HTMLInputElement).value)} /></Field>
            <Field label="Indemnités (€)"><input inputMode="decimal" value={v.settings.indemnites} onInput={(e) => setSetting('indemnites', (e.target as HTMLInputElement).value)} /></Field>
            <Field label="Prélèvement à la source (%)"><input inputMode="decimal" value={v.settings.tauxImposition} onInput={(e) => setSetting('tauxImposition', (e.target as HTMLInputElement).value)} /></Field>
          </div>
          <div class="note">Sans fiche de paie, taux de cotisations {pct(v.settings.cotFallback)} et retenues {euro2(v.settings.retenuesFallback)} par défaut.</div>
        </div>
      )}
    </div>
  );
}
