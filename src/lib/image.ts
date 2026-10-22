// Фото берём с images.prom.ua. Оригиналы тяжёлые (сотни КБ), а у Прома есть готовые
// уменьшенные копии: <id>_w300_h300_<имя>.jpg. Для остальных адресов возвращаем как есть.
const PROM = /^https:\/\/images\.prom\.ua\/(?:og_[^/]*\/)?(\d+)_(?!w\d+_h\d+_)(.+)$/;

export function thumb(url: string, size: number): string {
  const m = url.match(PROM);
  return m ? `https://images.prom.ua/${m[1]}_w${size}_h${size}_${m[2]}` : url;
}
