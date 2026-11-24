const names = new Intl.Collator('uz', { numeric: true, sensitivity: 'base' });
export function byName<T>(items: T[], name: (item: T) => string, id: (item: T) => string): T[] {
  const key = (value: string) => value.normalize('NFKC').trim().replace(/[‘’ʻʼ`]/g, "'").replace(/\s+/g, ' ');
  return items.sort((a, b) => names.compare(key(name(a)), key(name(b))) || id(a).localeCompare(id(b)));
}
