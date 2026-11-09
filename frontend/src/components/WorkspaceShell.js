"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { GimoonBrand } from "@/components/Brand";
import { api, csrfHeaders } from "@/lib/smartlinks";

function SidebarPanel({ active, onNavigate, onNewLink, onClose }) {
  function navigate(event, href) {
    onClose?.();
    onNavigate?.(event, href);
  }

  const navClass = (key) =>
    `mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-medium transition ${active === key ? "bg-white/[.09] text-white" : "text-[#8e94a6] hover:bg-white/[.07] hover:text-white"}`;

  return (
    <>
      <div className="flex items-center justify-between">
        <GimoonBrand
          href="/"
          onClick={(event) => navigate(event, "/")}
          className="px-2 text-2xl tracking-[-.06em]"
          light
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <Icon name="plus" size={18} className="rotate-45" />
          </button>
        )}
      </div>

      <div className="mt-12 px-3 text-[9px] font-semibold tracking-[.14em] text-[#666b7c]">
        WORKSPACE
      </div>
      <a
        href="/"
        onClick={(event) => navigate(event, "/")}
        className={navClass("library")}
      >
        <Icon name="grid" size={17} />내 스마트 링크
      </a>
      <button
        type="button"
        onClick={() => {
          onClose?.();
          onNewLink ? onNewLink() : (window.location.href = "/create?new=1");
        }}
        className={navClass("create")}
      >
        <Icon name="plus" size={17} />새 링크 만들기
      </button>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/[.025] p-4">
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#292c40] text-[#9ca7ff]">
          <Icon name="music" size={16} />
        </div>
        <p className="text-xs font-medium text-[#d8dbe4]">음악에 더 가까이.</p>
        <p className="mt-2 text-[11px] leading-5 text-[#777f93]">
          팬이 원하는 곳에서
          <br />
          당신의 음악을 만나도록.
        </p>
      </div>
      <div className="mt-6 flex items-center gap-2 px-2 text-[10px] text-[#666b7c]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#6d7e9b]" />
        Smart links studio
      </div>
    </>
  );
}

export default function WorkspaceShell({
  active,
  title,
  user,
  children,
  onNavigate,
  onNewLink,
  onSignOut,
  fixedContent = false,
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleNewLink = onNewLink || (() => router.push("/create/choose"));

  async function signOut() {
    try {
      if (onSignOut) {
        await onSignOut();
      } else {
        await api("auth/logout/", {
          method: "POST",
          headers: await csrfHeaders(),
        });
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
  }

  return (
    <div
      className={`min-h-dvh bg-[#f6f7fb] text-[#202431] ${fixedContent ? "xl:h-dvh xl:min-h-0 xl:overflow-hidden" : ""}`}
    >
      <aside
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-40 hidden w-[216px] flex-col bg-[#15171f] px-5 py-6 transition-transform duration-200 lg:flex ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarPanel
          active={active}
          onNavigate={onNavigate}
          onNewLink={handleNewLink}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-950/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[#15171f] px-5 py-6 shadow-2xl">
            <SidebarPanel
              active={active}
              onNavigate={onNavigate}
              onNewLink={handleNewLink}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div
        className={`transition-[margin] duration-200 ${sidebarOpen ? "lg:ml-[216px]" : ""} ${fixedContent ? "xl:flex xl:h-full xl:min-h-0 xl:flex-col" : ""}`}
      >
        <header className="sticky top-0 z-30 flex h-[76px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur sm:px-9 xl:px-12">
          <div className="flex min-w-0 items-center gap-3 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? "사이드바 숨기기" : "사이드바 보이기"}
              title={sidebarOpen ? "사이드바 숨기기" : "사이드바 보이기"}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#aab3fc] hover:text-[#5865f2] lg:flex"
            >
              <Icon name="menu" size={17} />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="사이드바 열기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#aab3fc] hover:text-[#5865f2] lg:hidden"
            >
              <Icon name="menu" size={17} />
            </button>
            <span className="font-semibold text-slate-800 lg:hidden">
              gimoon /
            </span>
            <span>워크스페이스</span>
            <span className="mx-1 text-slate-300">/</span>
            <span className="truncate font-medium text-slate-700">{title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {user ? (
              <>
                <span className="hidden max-w-48 truncate text-[11px] text-slate-400 sm:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="text-[11px] text-slate-500 hover:text-rose-600"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="text-[11px] font-medium text-[#5865f2] hover:text-[#404bd2]"
              >
                로그인
              </a>
            )}
          </div>
        </header>
        <div
          className={
            fixedContent ? "xl:min-h-0 xl:flex-1 xl:overflow-hidden" : ""
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
