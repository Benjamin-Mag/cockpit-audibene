import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

const PATHS = {
  'phone-off': 'M10.7 5.2a15 15 0 0 0 5.6 5.6l1.6-1.6a1 1 0 0 1 1-.25 11 11 0 0 0 3.4.55 1 1 0 0 1 1 1V14a1 1 0 0 1-1 1A17 17 0 0 1 4 6a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1 11 11 0 0 0 .55 3.4 1 1 0 0 1-.25 1L8.1 12M2 2l20 20',
  clipboard: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 6H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2M9 13h6M9 17h4',
  message: 'M21 12a8 8 0 0 1-11.5 7.2L4 21l1.6-4.5A8 8 0 1 1 21 12z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6',
  calendar: 'M4 6h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM16 3v4M8 3v4M3 11h18',
  coins: 'M8 8m-5 0a5 3 0 1 0 10 0a5 3 0 1 0-10 0M3 8v4c0 1.7 2.2 3 5 3s5-1.3 5-3V8M3 12v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4M16 9c2.8 0 5 1.3 5 3v4c0 1.7-2.2 3-5 3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  check: 'M20 6 9 17l-5-5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  upload: 'M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  download: 'M12 4v12m0 0 4-4m-4 4-4-4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  building: 'M3 21h18M5 21V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v16M9 8h2m2 0h2M9 12h2m2 0h2M9 16h2m2 0h2',
  stetho: 'M4.8 3.5a1 1 0 0 0-1 1V9a5 5 0 0 0 10 0V4.5a1 1 0 0 0-1-1M8.8 14v2a5 5 0 0 0 10 0v-1M18.8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  copy: 'M9 9h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

interface BtnProps {
  kind?: 'primary' | 'soft' | 'ghost' | 'danger';
  big?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
  title?: string;
  onClick?: () => void;
  children?: ComponentChildren;
  class?: string;
}
export function Btn({ kind = 'primary', big, busy, disabled, icon, title, onClick, children, class: cls }: BtnProps) {
  return (
    <button class={['btn', kind !== 'primary' ? kind : '', big ? 'big' : '', !children ? 'icon' : '', cls ?? ''].join(' ')} disabled={disabled || busy} title={title} onClick={onClick} type="button">
      {busy ? <span class="spin" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function Chip({ on, onClick, children, small, onRemove }: { on?: boolean; onClick?: () => void; children: ComponentChildren; small?: boolean; onRemove?: () => void }) {
  return (
    <button type="button" class={['chip', on ? 'on' : '', small ? 'small' : ''].join(' ')} onClick={onClick}>
      {children}
      {onRemove && (
        <span class="x" title="Supprimer" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Icon name="x" size={11} />
        </span>
      )}
    </button>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div class="seg">
      {options.map((o) => (
        <button type="button" key={o.id} class={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Field({ label, children, right }: { label: string; children: ComponentChildren; right?: ComponentChildren }) {
  return (
    <div class="field">
      <div class="field-head"><span class="label">{label}</span>{right}</div>
      {children}
    </div>
  );
}

export interface ToastMsg { msg: string; kind: 'ok' | 'err' | 'info'; id: number }
export function Toast({ toast }: { toast: ToastMsg | null }) {
  const [shown, setShown] = useState<ToastMsg | null>(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    setOut(false);
    const t1 = setTimeout(() => setOut(true), toast.kind === 'err' ? 5200 : 2600);
    const t2 = setTimeout(() => setShown(null), toast.kind === 'err' ? 5700 : 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast]);
  if (!shown) return null;
  return (
    <div class={['toast', shown.kind, out ? 'out' : ''].join(' ')} key={shown.id}>
      <Icon name={shown.kind === 'err' ? 'alert' : 'check'} />
      <span>{shown.msg}</span>
    </div>
  );
}
