import Icon from "@/components/Icon";
import ArtistLinkMark from "@/components/ArtistLinkMark";
import { PageFooter } from "@/components/Brand";

export default function ArtistPageView({ artist, preview = false }) {
  return (
    <main
      className={`flex flex-col bg-[#f6f7fb] text-[#202431] ${preview ? "pointer-events-none h-full min-h-0 overflow-y-auto" : "min-h-dvh"}`}
    >
      <section
        className={`mx-auto w-full max-w-2xl flex-1 px-5 ${preview ? "py-4 sm:px-6 sm:py-6" : "py-8 sm:px-8 sm:py-12"}`}
      >
        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-48px_rgba(32,42,70,0.4)]">
          <div
            className={`relative flex items-end overflow-hidden bg-[#171923] ${preview ? "min-h-52 p-5 sm:min-h-64 sm:p-7" : "min-h-64 p-6 sm:min-h-80 sm:p-9"}`}
          >
            {artist.image_url && (
              <img
                src={artist.image_url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/15" />
            {artist.image_url ? (
              <img
                src={artist.image_url}
                alt={`${artist.name} 프로필 이미지`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/60">
                <Icon name="music" size={72} />
              </div>
            )}
            <div className="relative z-10 flex items-end gap-4 text-white">
              <div>
                <p className="text-[10px] font-semibold tracking-[.18em] text-white/70">
                  ARTIST
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  {artist.name || "아티스트 이름"}
                </h1>
                {artist.location && (
                  <p className="mt-2 text-xs text-white/75">
                    {artist.location}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className={preview ? "p-5 sm:p-6" : "p-6 sm:p-9"}>
            {artist.bio && (
              <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
                {artist.bio}
              </p>
            )}
            <div className={artist.bio ? "mt-7" : ""}>
              <h2 className="text-xs font-semibold text-slate-500">링크</h2>
              {artist.links?.length ? (
                <div className="mt-3 space-y-2">
                  {artist.links.map((link, index) => (
                    <a
                      key={link.id || `${link.title}:${index}`}
                      href={link.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition hover:border-[#aab3fc] hover:bg-[#f7f8ff]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <ArtistLinkMark platform={link.platform} />
                        <span className="truncate text-sm font-semibold text-slate-800">
                          {link.title || "링크 이름"}
                        </span>
                      </span>
                      <Icon
                        name="arrow"
                        size={16}
                        className="shrink-0 text-slate-400 transition group-hover:text-[#5865f2]"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-xs text-slate-400">
                  아직 등록된 링크가 없습니다.
                </p>
              )}
            </div>
          </div>
        </article>
      </section>

      {!preview && <PageFooter />}
    </main>
  );
}
