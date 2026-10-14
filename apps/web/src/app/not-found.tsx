import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-[var(--micow-muted)]">Halaman tidak ditemukan.</p>
      <Link href="/" className="mt-6 text-[var(--micow-accent)] underline">
        Kembali ke beranda
      </Link>
    </main>
  );
}
