export function configurations(n: number): string {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${n === 1 ? 'konfiguracja' : few ? 'konfiguracje' : 'konfiguracji'}`;
}

export function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function mailto(email: string, subject: string, body?: string): string {
  const params = [`subject=${encodeURIComponent(subject)}`];
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}?${params.join('&')}`;
}

export interface NavLink {
  id: string;
  label: string;
  meta: string;
  /** Where the desktop bar shows the link. "menu" means only the mobile menu. */
  place: 'left' | 'right' | 'menu';
}
