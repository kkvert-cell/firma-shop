// Дерево каталогу для меню, сторінки «Каталог», головної, підгруп і карти сайту.
// Рахує товари В НАЯВНОСТІ з урахуванням усіх вкладених підгруп; групи, де немає жодного товару в наявності, в дерево не потрапляють
// (на сторінку такої групи за прямим посиланням зайти можна, але в меню, картках, підгрупах і карті сайту її немає).
// Результат на короткий час кешується в пам'яті (дерево змінюється рідко, а меню потрібне на кожній сторінці).

import type { Run } from "./catalog";

export type TreeNode = {
  id: string;
  name: string;
  slug: string;
  path: string;
  parentId: string | null;
  n: number; // товарів у групі разом з усіма вкладеними підгрупами
  image: string | null;
  children: TreeNode[];
};

const TTL_MS = 2 * 60_000;
let cache: { at: number; tree: TreeNode[] } | null = null;

export function invalidateCatalogTree() {
  cache = null;
}

export async function getCatalogTree(run: Run): Promise<TreeNode[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.tree;
  const [cats, counts, images] = await Promise.all([
    run(`SELECT id, name, slug, path, "parentId", "imageUrl" FROM "Category" WHERE "isActive" = true AND path IS NOT NULL ORDER BY "sortOrder", name`),
    run(`SELECT "categoryId" AS id, count(*)::int AS n FROM "Product" WHERE "isHidden" = false AND "isAvailable" = true AND price > 0 GROUP BY "categoryId"`),
    run(
      `SELECT DISTINCT ON (p."categoryId") p."categoryId" AS id, i.url
         FROM "Product" p JOIN "ProductImage" i ON i."productId" = p.id
        WHERE p."isHidden" = false AND p."isAvailable" = true
        ORDER BY p."categoryId", i."sortOrder", p."updatedAt" DESC`
    ),
  ]);
  const direct = new Map(counts.map((r) => [String(r.id), Number(r.n)]));
  const img = new Map(images.map((r) => [String(r.id), String(r.url)]));
  const nodes = new Map<string, TreeNode & { own: number; ownImage: string | null }>();
  for (const c of cats) {
    nodes.set(String(c.id), {
      id: String(c.id),
      name: String(c.name),
      slug: String(c.slug),
      path: String(c.path),
      parentId: c.parentId ? String(c.parentId) : null,
      n: 0,
      image: c.imageUrl ? String(c.imageUrl) : null,
      children: [],
      own: direct.get(String(c.id)) ?? 0,
      ownImage: img.get(String(c.id)) ?? null,
    });
  }
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else if (!node.parentId) roots.push(node);
  }
  // рахуємо знизу вгору й відкидаємо порожні
  const finish = (node: TreeNode & { own: number; ownImage: string | null }): void => {
    node.children = node.children.filter((c) => {
      finish(c as TreeNode & { own: number; ownImage: string | null });
      return c.n > 0;
    });
    node.n = node.own + node.children.reduce((s, c) => s + c.n, 0);
    node.image = node.image ?? node.ownImage ?? node.children.find((c) => c.image)?.image ?? null;
  };
  const tree = roots.filter((r) => {
    finish(r as TreeNode & { own: number; ownImage: string | null });
    return r.n > 0;
  });
  cache = { at: Date.now(), tree };
  return tree;
}

export function findNode(tree: TreeNode[], id: string): TreeNode | null {
  for (const n of tree) {
    if (n.id === id) return n;
    const f = findNode(n.children, id);
    if (f) return f;
  }
  return null;
}

export function flattenTree(tree: TreeNode[]): TreeNode[] {
  return tree.flatMap((n) => [n, ...flattenTree(n.children)]);
}
