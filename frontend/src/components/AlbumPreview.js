import Icon from "./Icon";
import SmartLinkPageView from "./SmartLinkPageView";

export default function AlbumPreview({ album, links = [], published, design }) {
  if (!album) {
    return (
      <aside className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-600">
            공개 페이지 미리보기
          </h2>
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
            미리보기
          </span>
        </div>
        <div className="grid min-h-[520px] place-items-center rounded-[22px] border border-slate-200 bg-white text-center shadow-[0_12px_36px_-20px_rgba(32,42,70,0.25)]">
          <div>
            <Icon name="music" size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-xs text-slate-400">
              앨범을 불러오면 공개 페이지를 미리 볼 수 있어요.
            </p>
          </div>
        </div>
      </aside>
    );
  }

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
      <div className="h-[min(68dvh,760px)] min-h-[420px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_36px_-20px_rgba(32,42,70,0.25)]">
        <SmartLinkPageView
          album={album}
          links={links}
          design={design}
          preview
        />
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <Icon name="globe" size={12} /> 팬에게 공유될 페이지입니다
      </p>
    </aside>
  );
}
