"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import PlatformMark from "@/components/PlatformMark";
import WorkspaceShell from "@/components/WorkspaceShell";
import { api, csrfHeaders, platformNames } from "@/lib/smartlinks";

const libraryKey = "gimoon-smartlink-library";
const filters = [
  ["all", "전체"],
  ["smartlink", "스마트 링크"],
  ["artist", "아티스트 명함"],
];

export default function LibraryPage() {
  const router = useRouter();
  const [links, setLinks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    api("auth/me/")
      .then((account) => {
        if (active) setUser(account.user);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        page: String(page),
        type: filter,
      });
      if (search) query.set("search", search);
      const response = await api(`library/?${query}`);
      setLinks(
        response.results
          .filter((item) => item.kind === "smartlink")
          .map(({ kind, ...item }) => item),
      );
      setArtists(
        response.results
          .filter((item) => item.kind === "artist")
          .map(({ kind, ...item }) => item),
      );
      setTotalCount(response.count);
      setPageCount(Math.max(1, Math.ceil(response.count / 20)));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "목록을 불러오지 못했습니다.",
      );
      if (requestError?.message?.includes("로그인")) router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [filter, page, router, search]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function resetList() {
    setSearchInput("");
    setSearch("");
    setFilter("all");
    setPage(1);
  }

  function clearSearch() {
    setSearchInput("");
  }

  function changeFilter(nextFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  function changePage(nextPage) {
    setPage(Math.min(pageCount, Math.max(1, nextPage)));
  }

  async function removeLink(link) {
    if (!window.confirm(`“${link.album.title}” 스마트 링크를 삭제할까요?`))
      return;
    try {
      const saved = JSON.parse(localStorage.getItem(libraryKey) || "[]");
      const capability = saved.find((item) => item.id === link.resolution_id);
      await api(`smartlinks/${link.slug}/`, {
        method: "DELETE",
        headers: await csrfHeaders(
          capability?.token ? { "X-Edit-Token": capability.token } : {},
        ),
      });
      localStorage.setItem(
        libraryKey,
        JSON.stringify(saved.filter((item) => item.id !== link.resolution_id)),
      );
      setLinks((current) => current.filter((item) => item.slug !== link.slug));
      setTotalCount((current) => Math.max(0, current - 1));
      if (items.length === 1 && page > 1) setPage((current) => current - 1);
      else loadLinks();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "삭제하지 못했습니다.",
      );
    }
  }

  async function removeArtist(artist) {
    if (!window.confirm(`“${artist.name}” 아티스트 명함을 삭제할까요?`)) return;
    try {
      await api(`artists/${artist.slug}/`, {
        method: "DELETE",
        headers: await csrfHeaders(),
      });
      setArtists((current) => current.filter((item) => item.id !== artist.id));
      setTotalCount((current) => Math.max(0, current - 1));
      if (items.length === 1 && page > 1) setPage((current) => current - 1);
      else loadLinks();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "삭제하지 못했습니다.",
      );
    }
  }

  const items = useMemo(() => {
    const allItems = [
      ...links.map((item) => ({ kind: "smartlink", item })),
      ...artists.map((item) => ({ kind: "artist", item })),
    ];
    return allItems.sort(
      (first, second) =>
        new Date(second.item.created_at) - new Date(first.item.created_at),
    );
  }, [artists, links]);
  const hasActiveListState = Boolean(
    searchInput || search || filter !== "all" || page > 1,
  );

  return (
    <WorkspaceShell active="library" title="내 스마트 링크" user={user}>
      <section className="mx-auto max-w-5xl px-5 pt-[clamp(1rem,3vh,2.5rem)] pb-[clamp(1rem,4vh,4rem)] sm:px-8 xl:px-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[.16em] text-[#5865f2]">
              YOUR LIBRARY
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              내 스마트 링크
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              음악 링크와 아티스트 명함을 한 곳에서 관리하세요.
            </p>
          </div>
          <a href="/create/choose" className="primary-button">
            <Icon name="plus" size={14} /> 새 링크 만들기
          </a>
        </div>

        <form onSubmit={submitSearch} className="mb-4 flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">링크 검색</span>
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="앨범명, 아티스트명, 소개 문구 검색"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pr-10 pl-9 text-xs outline-none transition placeholder:text-slate-400 focus:border-[#aab3fc] focus:ring-2 focus:ring-[#5865f2]/10"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="검색어 지우기"
                title="검색어 지우기"
                className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="plus" size={15} className="rotate-45" />
              </button>
            )}
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[#5865f2] px-4 text-xs font-semibold text-white hover:bg-[#4955df]"
          >
            검색
          </button>
          {hasActiveListState && (
            <button
              type="button"
              onClick={resetList}
              className="rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              초기화
            </button>
          )}
        </form>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold text-slate-600">
            검색 결과 <span className="ml-1 text-[#5865f2]">{totalCount}</span>
          </h2>
          <div
            role="tablist"
            aria-label="페이지 유형 필터"
            className="flex rounded-lg border border-slate-200 bg-white p-1"
          >
            {filters.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => changeFilter(key)}
                className={`rounded-md px-3 py-2 text-[11px] transition ${filter === key ? "bg-[#eef0ff] font-semibold text-[#5865f2]" : "text-slate-500 hover:text-slate-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            목록을 불러오는 중…
          </div>
        ) : items.length ? (
          <>
            <div className="space-y-3">
              {items.map(({ kind, item }) => {
                const isArtist = kind === "artist";
                const title = isArtist ? item.name : item.album.title;
                const description = isArtist
                  ? item.bio || item.location || "아티스트 명함"
                  : item.album.artist;
                const image = isArtist ? item.image_url : item.album.cover;
                const viewUrl = isArtist
                  ? `/artist/${item.slug}`
                  : `/s/${item.slug}`;
                const editUrl = isArtist
                  ? `/artists/edit/${item.slug}`
                  : `/create?edit=${item.slug}`;

                return (
                  <article
                    key={`${kind}:${item.slug}`}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5"
                  >
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        referrerPolicy={isArtist ? undefined : "no-referrer"}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Icon name={isArtist ? "music" : "link"} size={24} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                          {title}
                        </h3>
                        <span className="rounded-full bg-[#f0f2ff] px-2 py-1 text-[9px] font-medium text-[#5865f2]">
                          {isArtist ? "아티스트 명함" : "스마트 링크"}
                        </span>
                        {isArtist && (
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] ${item.is_published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                          >
                            {item.is_published ? "공개" : "비공개"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {description}
                      </p>
                      {isArtist ? (
                        <p className="mt-2 text-[10px] text-slate-400">
                          홍보 링크 {item.links.length}개
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.links.map((link) => (
                            <span
                              key={link.platform}
                              title={
                                platformNames[link.platform] || link.platform
                              }
                            >
                              <PlatformMark platform={link.platform} small />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(!isArtist || item.is_published) && (
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          보기 <Icon name="external" size={12} />
                        </a>
                      )}
                      <a
                        href={editUrl}
                        className="rounded-lg border border-[#dfe2ff] bg-[#f5f6ff] px-3 py-2 text-[11px] font-medium text-[#5865f2] hover:bg-[#eceeff]"
                      >
                        수정
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          isArtist ? removeArtist(item) : removeLink(item)
                        }
                        className="rounded-lg border border-rose-100 px-3 py-2 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <nav
              aria-label="목록 페이지"
              className="mt-6 flex items-center justify-center gap-3"
            >
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-xs tabular-nums text-slate-500">
                {page} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => changePage(page + 1)}
                disabled={page >= pageCount}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            </nav>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0f2ff] text-[#5865f2]">
              <Icon name={filter === "artist" ? "music" : "link"} size={20} />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-slate-800">
              {search
                ? "검색 결과가 없습니다"
                : filter === "artist"
                  ? "아직 만든 아티스트 명함이 없습니다"
                  : filter === "smartlink"
                    ? "아직 발행한 스마트 링크가 없습니다"
                    : "아직 만든 페이지가 없습니다"}
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              {search
                ? "다른 검색어로 다시 찾아보세요."
                : "새 링크 만들기에서 페이지 종류를 선택해 시작하세요."}
            </p>
            {!search && (
              <a href="/create/choose" className="primary-button mx-auto mt-5">
                새 링크 만들기 <Icon name="arrow" size={14} />
              </a>
            )}
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
