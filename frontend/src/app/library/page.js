"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import PlatformMark from "@/components/PlatformMark";
import { api, csrfHeaders, platformNames } from "@/lib/smartlinks";

const libraryKey = "gimoon-smartlink-library";

export default function LibraryPage() {
  const router = useRouter();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  async function loadLinks() {
    setLoading(true);
    setError("");
    try {
      const account = await api("auth/me/");
      setUser(account.user);
      const saved = JSON.parse(localStorage.getItem(libraryKey) || "[]");
      const tokens = saved
        .filter((item) => item.id && item.token)
        .map((item) => item.token)
        .join(",");
      setLinks(
        await api("smartlinks/mine/", { headers: { "X-Edit-Tokens": tokens } }),
      );
    } catch (e) {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLinks();
  }, [router]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했습니다.");
    }
  }

  async function signOut() {
    try {
      await api("auth/logout/", {
        method: "POST",
        headers: await csrfHeaders(),
      });
      setUser(null);
      await loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그아웃하지 못했습니다.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#202431]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[216px] flex-col bg-[#15171f] px-5 py-8 lg:flex">
        <a
          href="/"
          className="flex items-center gap-2.5 px-2 text-2xl font-bold tracking-[-.06em] text-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5865f2]">
            <Icon name="link" size={19} />
          </span>
          gimoon{" "}
          <span className="self-end pb-1 text-[9px] font-normal tracking-wider text-slate-500">
            STUDIO
          </span>
        </a>
        <div className="mt-12 px-3 text-[9px] font-semibold tracking-[.14em] text-[#666b7c]">
          WORKSPACE
        </div>
        <a
          href="/"
          className="mt-4 flex w-full items-center gap-3 rounded-lg bg-white/[.07] px-3 py-3 text-left text-xs font-medium text-white"
        >
          <Icon name="grid" size={17} />내 스마트 링크
        </a>
        <a
          href="/create?new=1"
          className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-xs font-medium text-[#8e94a6] transition hover:bg-white/[.07] hover:text-white"
        >
          <Icon name="plus" size={17} />새 링크 만들기
        </a>
        <div className="mt-auto rounded-xl border border-white/10 bg-white/[.025] p-4">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#292c40] text-[#9ca7ff]">
            <Icon name="music" size={16} />
          </div>
          <p className="text-xs font-medium text-[#d8dbe4]">
            음악에 더 가까이.
          </p>
          <p className="mt-2 text-[11px] leading-5 text-[#777f93]">
            팬이 원하는 곳에서
            <br />
            당신의 음악을 만나도록.
          </p>
        </div>
      </aside>
      <div className="lg:ml-[216px]">
        <header className="flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white px-5 sm:px-9 xl:px-12">
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-800 lg:hidden">
              gimoon /{" "}
            </span>
            워크스페이스 <span className="mx-1 text-slate-300">/</span>
            <span className="font-medium text-slate-700">내 스마트 링크</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden text-[11px] text-slate-400 sm:inline">
                {user.email}
              </span>
            )}
            {user ? (
              <button
                onClick={signOut}
                className="text-[11px] text-slate-500 hover:text-rose-600"
              >
                로그아웃
              </button>
            ) : (
              <a
                href="/login"
                className="text-[11px] font-medium text-[#5865f2]"
              >
                로그인
              </a>
            )}
          </div>
        </header>
        <section className="mx-auto max-w-5xl px-5 pt-10 pb-16 sm:px-8 xl:px-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[.16em] text-[#5865f2]">
                YOUR LIBRARY
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                내 스마트 링크
              </h1>
              <p className="mt-2 text-xs text-slate-500">
                {user
                  ? `${user.email} 계정의 링크를 관리합니다.`
                  : "로그인하면 여러 기기에서 링크를 관리할 수 있습니다."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadLinks}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-slate-300"
              >
                <Icon name="grid" size={14} /> 새로고침
              </button>
              <a href="/create?new=1" className="primary-button">
                <Icon name="plus" size={14} /> 새 링크 만들기
              </a>
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
              링크를 불러오는 중…
            </div>
          ) : links.length ? (
            <div className="space-y-3">
              {links.map((link) => (
                <article
                  key={link.slug}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5"
                >
                  {link.album.cover ? (
                    <img
                      src={link.album.cover}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Icon name="music" size={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-slate-900">
                      {link.album.title}
                    </h2>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {link.album.artist}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {link.links.map((item) => (
                        <span
                          key={item.platform}
                          title={platformNames[item.platform] || item.platform}
                        >
                          <PlatformMark platform={item.platform} small />
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/s/${link.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      보기 <Icon name="external" size={12} />
                    </a>
                    <a
                      href={`/create?edit=${link.slug}`}
                      className="rounded-lg border border-[#dfe2ff] bg-[#f5f6ff] px-3 py-2 text-[11px] font-medium text-[#5865f2] hover:bg-[#eceeff]"
                    >
                      수정
                    </a>
                    <button
                      onClick={() => removeLink(link)}
                      className="rounded-lg border border-rose-100 px-3 py-2 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0f2ff] text-[#5865f2]">
                <Icon name="link" size={20} />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-slate-800">
                아직 발행한 스마트 링크가 없습니다
              </h2>
              <p className="mt-2 text-xs text-slate-400">
                스마트 링크를 발행하면 이 브라우저의 목록에 표시됩니다.
              </p>
              <a href="/create?new=1" className="primary-button mx-auto mt-5">
                첫 링크 만들기 <Icon name="arrow" size={14} />
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
