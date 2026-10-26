import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { legalPages } from "@/lib/legal-pages";
import { sellerReady } from "@/lib/legal";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return legalPages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = legalPages().find((p) => p.slug === slug);
  return { title: page?.title ?? "Інформація", robots: sellerReady() ? undefined : { index: false, follow: false } };
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  const page = legalPages().find((p) => p.slug === slug);
  if (!page) notFound();
  return (
    <main>
      {!sellerReady() && (
        <p className="notice">Службова помітка: реквізити продавця ще не заповнені (файл src/lib/legal.ts). Перед запуском сайту їх потрібно вказати.</p>
      )}
      <h1 className="heading page-title">{page.title}</h1>
      {page.lead && <p className="muted">{page.lead}</p>}
      {page.sections.map((s) => (
        <section key={s.h} className="legal-section">
          <h2 className="heading section-title">{s.h}</h2>
          {s.p.map((t, i) => <p key={i}>{t}</p>)}
        </section>
      ))}
      <p><Link href="/">← На головну</Link></p>
    </main>
  );
}
