export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opts,
  }).format(new Date(iso));
}

export function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso));
}

export function generateEmployeeId(role: string) {
  const prefix: Record<string, string> = {
    super_admin: 'SA',
    md: 'MD',
    department_head: 'DH',
    floor_supervisor: 'FS',
    staff: 'ST',
    it_team: 'IT',
    maintenance_team: 'MT',
    biomedical_team: 'BM',
  };
  const p = prefix[role] ?? 'EMP';
  const num = Math.floor(Math.random() * 90000) + 10000;
  return `AVR-${p}-${num}`;
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}
