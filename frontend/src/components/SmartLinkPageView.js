import { platformNames } from "@/lib/smartlinks";
import Icon from "@/components/Icon";
import PlatformMark from "@/components/PlatformMark";
import { PageFooter } from "@/components/Brand";

export default function SmartLinkPageView({
  album,
  links = [],
  design = "classic",
  preview = false,
}) {
  const split = design === "split";

  return (
    <main
      onClick={preview ? (event) => event.preventDefault() : undefined}
      className={`relative flex flex-col items-center ${split ? "bg-black" : "bg-white"} ${preview ? "h-full min-h-0 overflow-y-auto" : "min-h-dvh"}`}
    >
      <section
        className={`w-full bg-white ${preview ? "flex-none" : "min-h-0 flex-1"} ${split ? (preview ? "min-h-full" : "min-h-[calc(100dvh-56px)]") : "mx-auto max-w-[400px] px-5 py-4 text-center sm:px-7"}`}
      >
        {split ? (
          <div
            className={`grid grid-cols-1 md:grid-cols-2 ${preview ? "min-h-full" : "min-h-[calc(100dvh-56px)]"}`}
          >
            <div
              className={`relative flex items-center justify-center overflow-hidden bg-[#11131a] ${preview ? "min-h-[220px] md:min-h-0" : "min-h-[42dvh] md:min-h-[calc(100dvh-56px)]"}`}
            >
              {album.cover && (
                <img
                  src={album.cover}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-50"
                />
              )}
              <div className="absolute inset-0 bg-black/15" />
              <a
                href={album.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative block aspect-square max-w-full bg-[#1a1d2a] shadow-2xl ${preview ? "w-[min(76%,56dvh)]" : "w-[min(84%,84dvh)]"}`}
              >
                {album.cover ? (
                  <img
                    src={album.cover}
                    alt={`${album.title} 앨범 커버`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full min-h-64 items-center justify-center text-[#b8c3ff]">
                    <Icon name="music" size={72} />
                  </span>
                )}
              </a>
            </div>
            <div className="flex min-h-0 flex-col bg-white">
              <header
                className={`flex shrink-0 flex-col items-center justify-center bg-black px-5 py-6 text-center text-white ${preview ? "min-h-24 md:min-h-[22%]" : "min-h-32 md:min-h-[22vh]"}`}
              >
                <p className="text-xs text-white/75">{album.artist}</p>
                <h1 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                  {album.title}
                </h1>
                <a
                  href={album.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-white/55 hover:text-white"
                >
                  <PlatformMark platform={album.platform} small />
                  앨범 정보 · {platformNames[album.platform]}
                  <Icon name="external" size={10} />
                </a>
              </header>
              <div className="px-5 pt-3 pb-6 sm:px-8">
                <p className="mb-2 text-center text-xs font-medium text-slate-700">
                  Listen
                </p>
                {links.map((link) => (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between border-b border-slate-100 px-3 py-4 transition hover:bg-slate-50 sm:px-4"
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
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </section>
      <PageFooter interactive={!preview} />
    </main>
  );
}
