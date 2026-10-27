import { notFound } from "next/navigation";
import { platformNames } from "@/lib/smartlinks";
import Icon from "@/components/Icon";
import PlatformMark from "@/components/PlatformMark";
async function getLink(slug) {
  if (!/^[0-9a-f-]{36}$/i.test(slug)) notFound();
  const response = await fetch(
    `${process.env.API_INTERNAL_URL || "http://localhost:8000"}/api/smartlinks/${slug}/`,
    { cache: "no-store" },
  );
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("스마트 링크를 불러오지 못했습니다.");
  return response.json();
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { album } = await getLink(slug);
  return {
    title: `${album.artist} — ${album.title} | GIMOON`,
    description: `${album.title}을 원하는 음원 플랫폼에서 들어보세요.`,
    openGraph: {
      title: `${album.artist} — ${album.title}`,
      images: album.cover ? [album.cover] : [],
    },
  };
}
export default async function SmartLinkPage({ params }) {
  const { slug } = await params;
  const { album, links } = await getLink(slug);
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#f0f2f8] px-5 py-10 sm:py-14">
      <a
        href="/"
        className="mb-7 flex items-center gap-2 text-lg font-bold tracking-[-.05em] text-slate-800"
      >
        <Icon name="link" size={20} className="text-[#5865f2]" />
        gimoon
      </a>
      <section className="w-full max-w-[400px] rounded-[24px] border border-slate-200 bg-white p-7 text-center shadow-[0_20px_80px_-40px_rgba(32,42,70,0.25)] sm:p-8">
        <a
          href={album.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {album.cover ? (
            <img
              src={album.cover}
              alt={`${album.title} 앨범 커버`}
              referrerPolicy="no-referrer"
              className="aspect-square w-full rounded-xl object-contain"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-xl bg-[#1a1d2a] text-[#b8c3ff]">
              <Icon name="music" size={64} />
            </div>
          )}
        </a>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          {album.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{album.artist}</p>
        <a
          href={album.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-slate-400"
        >
          <PlatformMark platform={album.platform} small />
          앨범 정보 · {platformNames[album.platform]}
          <Icon name="external" size={10} />
        </a>
        <p className="mt-7 text-[10px] font-medium tracking-wider text-slate-400">
          원하는 플랫폼에서 들어보세요
        </p>
        <div className="mt-4 space-y-2.5">
          {links.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5 transition hover:border-[#aab3fc] hover:bg-[#f7f8ff]"
            >
              <span className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                <PlatformMark platform={link.platform} />
                {platformNames[link.platform] || link.platform}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-[#5865f2]">
                {link.platform === "lastfm" ? "앨범 정보" : "듣기"}
                <Icon name="external" size={12} />
              </span>
            </a>
          ))}
        </div>
      </section>
      <a
        href="/"
        className="mt-7 flex items-center gap-1.5 text-[11px] text-slate-400 transition hover:text-[#5865f2]"
      >
        나만의 스마트 링크 만들기
        <Icon name="arrow" size={13} />
      </a>
    </main>
  );
}
