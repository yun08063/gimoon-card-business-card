import Icon from "./Icon";
import PlatformMark from "./PlatformMark";
import { platformNames } from "@/lib/smartlinks";

function Cover({ album }) {
  return album?.cover ? (
    <img
      src={album.cover}
      alt={`${album.title} 앨범 커버`}
      referrerPolicy="no-referrer"
      className="aspect-square w-full rounded-xl object-cover"
    />
  ) : (
    <div className="record-art relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#1a1d2a]">
      <div className="absolute -top-10 -left-8 h-44 w-44 rounded-full bg-[#4c60f2]/40 blur-3xl" />
      <div className="vinyl-disc relative flex h-[76%] w-[76%] items-center justify-center rounded-full">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#b8c3ff]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1a1d2a]" />
        </div>
      </div>
      <span className="absolute right-4 bottom-3 text-[8px] tracking-[.18em] text-white/50">
        YOUR NEXT RELEASE
      </span>
    </div>
  );
}

function LinkList({ links, compact = false }) {
  return links.length ? (
    <div className={compact ? "space-y-1.5" : "mt-6 space-y-2"}>
      {links.map((link, index) => (
        <a
          key={link.id || `${link.platform}:${link.url || index}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-between rounded-lg border border-slate-200 text-left hover:border-[#aab3fc] ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}`}
        >
          <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
            <PlatformMark platform={link.platform} small />
            <span className="truncate">
              {link.platform_label ||
                platformNames[link.platform] ||
                "직접 등록"}
            </span>
            {link.verification === "manual" && !compact && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-normal text-slate-500">
                직접 추가
              </span>
            )}
          </span>
          <Icon name="external" size={12} className="shrink-0 text-slate-400" />
        </a>
      ))}
    </div>
  ) : (
    <div
      className={compact ? "space-y-1.5" : "mt-6 space-y-2"}
      aria-hidden="true"
    >
      {["w-24", "w-20", "w-28"].map((width) => (
        <div
          key={width}
          className="flex items-center gap-2.5 rounded-lg border border-dashed border-slate-200 px-3 py-3"
        >
          <span className="h-6 w-6 rounded-md bg-slate-100" />
          <span className={`h-1.5 rounded-full bg-slate-100 ${width}`} />
          <span className="ml-auto h-1.5 w-4 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function AlbumPreview({
  album,
  links = [],
  published,
  design = "classic",
}) {
  const split = design === "split";

  return (
    <aside className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-600">
          공개 페이지 미리보기
        </h2>
        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
          {published ? "발행됨" : "미리보기"}
        </span>
      </div>
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_36px_-20px_rgba(32,42,70,0.25)]">
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
          <span className="ml-2 text-[10px] text-slate-400">
            gimoon / {published ? "live" : "your-release"}
          </span>
        </div>
        {split ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 p-5 text-left sm:gap-7 sm:p-7">
            <div className="min-w-0">
              <Cover album={album} />
              <h3 className="mt-4 line-clamp-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {album?.title || "앨범의 첫인상"}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 sm:text-sm">
                {album?.artist || "앨범을 불러오면 정보가 표시됩니다"}
              </p>
              {album && (
                <a
                  href={album.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-[#5865f2]"
                >
                  <PlatformMark platform={album.platform} small />
                  앨범 정보 · {platformNames[album.platform]}
                  <Icon name="external" size={10} />
                </a>
              )}
            </div>
            <div className="min-w-0 self-center">
              <p className="mb-3 text-xs font-semibold text-slate-600">
                원하는 플랫폼에서 들어보세요
              </p>
              <LinkList links={links} compact />
              <p className="mt-3 flex items-center gap-1 text-[9px] font-semibold text-slate-300">
                <Icon name="link" size={10} /> gimoon
              </p>
            </div>
          </div>
        ) : (
          <div className="px-7 pt-7 pb-8 text-center">
            {album?.url ? (
              <a href={album.url} target="_blank" rel="noopener noreferrer">
                <Cover album={album} />
              </a>
            ) : (
              <Cover album={album} />
            )}
            <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-900">
              {album?.title || "앨범의 첫인상"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {album?.artist || "앨범을 불러오면 정보가 표시됩니다"}
            </p>
            <LinkList links={links} />
            {album && (
              <a
                href={album.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-[10px] text-slate-400 underline underline-offset-2"
              >
                앨범 정보 · {platformNames[album.platform]}
              </a>
            )}
            <p className="mt-6 flex items-center justify-center gap-1 text-[9px] font-semibold tracking-tight text-slate-300">
              <Icon name="link" size={11} /> gimoon
            </p>
          </div>
        )}
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <Icon name="globe" size={12} /> 팬에게 공유될 페이지입니다
      </p>
    </aside>
  );
}
