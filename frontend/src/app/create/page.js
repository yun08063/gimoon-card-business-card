"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSmartLink from "@/hooks/useSmartLink";
import { platformNames, platformStatusFor } from "@/lib/smartlinks";
import Icon from "@/components/Icon";
import PlatformMark from "@/components/PlatformMark";
import AlbumPreview from "@/components/AlbumPreview";

const statusNames = {
  disabled: "검색 제외",
  source: "원본",
  found: "후보 발견",
  not_found: "결과 없음",
  blocked: "접근 제한",
  credentials_required: "연결 설정 필요",
  manual_required: "직접 추가",
  error: "조회 실패",
  rate_limited: "요청 한도",
  unavailable: "조회 불가",
};

const platformHosts = {
  melon: ["melon.com"],
  genie: ["genie.co.kr"],
  bugs: ["bugs.co.kr"],
  flo: ["music-flo.com"],
  apple: ["music.apple.com", "itunes.apple.com"],
  deezer: ["deezer.com"],
  tidal: ["tidal.com"],
  youtube: ["youtube.com", "youtu.be"],
  amazon: [
    "amazon.com",
    "amazon.co.uk",
    "amazon.co.jp",
    "amazon.ca",
    "amazon.com.mx",
    "amazon.de",
    "amazon.fr",
    "amazon.it",
    "amazon.es",
  ],
  soundcloud: ["soundcloud.com"],
  lastfm: ["last.fm"],
  spotify: ["spotify.com"],
};

export default function Home() {
  const router = useRouter();
  const state = useSmartLink();
  const {
    url,
    setUrl,
    country,
    setCountry,
    job,
    selected,
    setSelected,
    manual,
    setManual,
    error,
    busy,
    publishing,
    published,
    setPublished,
    copied,
    user,
    authLoading,
    editing,
    platforms: platformCatalog,
    submit,
    publish,
    copyLink,
    resetDraft,
    signOut,
  } = state;
  const [copiedCandidate, setCopiedCandidate] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState("");
  const [leavePrompt, setLeavePrompt] = useState(null);
  const confirmedLeave = useRef(false);
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, router, user]);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const album = job?.result.album;
  const platforms = job?.result.platforms || [];
  const platformModes = Object.fromEntries(
    platformCatalog.map((platform) => [platform.key, platform.mode]),
  );
  const currentPlatforms = platforms.length
    ? platforms.map((platform) => ({
        ...platformCatalog.find((item) => item.key === platform.key),
        key: platform.key,
        status: platform.status,
      }))
    : platformCatalog;
  const found = platforms.filter((platform) => platform.candidates.length);
  const unavailable = platforms.filter(
    (platform) => !platform.candidates.length,
  );
  const manualLinks = manual
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => {
      let hostname = "";
      try {
        hostname = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        // Ignore malformed entries; addManualLink validates URLs before saving.
      }
      const platformKey = Object.entries(platformHosts).find(([, hosts]) =>
        hosts.some(
          (host) => hostname === host || hostname.endsWith(`.${host}`),
        ),
      )?.[0];
      return {
        url,
        hostname,
        platformKey,
        label: platformKey ? platformNames[platformKey] : hostname,
      };
    });
  const chosen = platforms.flatMap((platform) =>
    platform.candidates.filter(
      (candidate) => selected[platform.key] === candidate.id,
    ),
  );
  const count =
    chosen.length + manual.split("\n").filter((line) => line.trim()).length;
  const hasDraft = Boolean(
    !published &&
    (url.trim() || job || manual.trim() || Object.keys(selected).length),
  );
  const previewLinks = published?.links || [
    ...chosen,
    ...manualLinks.map(({ url, platformKey, label }) => ({
      id: `manual:${url}`,
      platform: platformKey || "manual",
      platform_label: label || "직접 등록",
      url,
      verification: "manual",
    })),
  ];
  const step = published ? 2 : album && job?.status === "ready" ? 1 : 0;

  useEffect(() => {
    function confirmBrowserExit(event) {
      if (!hasDraft || confirmedLeave.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", confirmBrowserExit);
    return () => window.removeEventListener("beforeunload", confirmBrowserExit);
  }, [hasDraft]);

  function guardNavigation(event, href) {
    if (!hasDraft) return;
    event.preventDefault();
    setLeavePrompt({ type: "navigate", href });
  }

  function startNewLink() {
    if (hasDraft) {
      setLeavePrompt({ type: "new" });
      return;
    }
    resetDraft();
    setManualInput("");
    setManualError("");
  }

  function confirmLeave() {
    if (leavePrompt?.type === "new") {
      resetDraft();
      setManualInput("");
      setManualError("");
    } else if (leavePrompt?.href) {
      confirmedLeave.current = true;
      window.location.assign(leavePrompt.href);
    }
    setLeavePrompt(null);
  }

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] text-sm text-slate-500">
        {authLoading ? "로그인 상태를 확인하는 중…" : "로그인이 필요합니다."}
      </main>
    );
  }

  function choose(key, id) {
    setSelected({ ...selected, [key]: id });
    setPublished(null);
  }

  async function copyCandidate(candidate) {
    try {
      await navigator.clipboard.writeText(candidate.url);
      setCopiedCandidate(candidate.id);
      window.setTimeout(() => setCopiedCandidate(""), 1800);
    } catch {
      window.prompt("주소를 복사해 주세요", candidate.url);
    }
  }

  function addManualLink() {
    const value = manualInput.trim();
    if (!value) return;
    try {
      if (new URL(value).protocol !== "https:") throw new Error();
    } catch {
      setManualError("유효한 HTTPS 앨범 주소를 입력해 주세요.");
      return;
    }
    const entries = manual
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.includes(value)) {
      setManualError("이미 추가한 주소입니다.");
      return;
    }
    setManual([...entries, value].join("\n"));
    setManualInput("");
    setManualError("");
    setPublished(null);
  }

  function removeManualLink(value) {
    setManual(
      manual
        .split("\n")
        .map((entry) => entry.trim())
        .filter((entry) => entry && entry !== value)
        .join("\n"),
    );
    setPublished(null);
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#202431]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[216px] flex-col bg-[#15171f] px-5 py-8 lg:flex">
        <a
          href="/"
          onClick={(event) => guardNavigation(event, "/")}
          className="flex items-center gap-2.5 px-2 text-2xl font-bold tracking-[-.06em] text-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5865f2]">
            <Icon name="link" size={19} />
          </span>
          gimoon
          <span className="self-end pb-1 text-[9px] font-normal tracking-wider text-slate-500">
            STUDIO
          </span>
        </a>
        <div className="mt-12 px-3 text-[9px] font-semibold tracking-[.14em] text-[#666b7c]">
          WORKSPACE
        </div>
        <a
          href="/"
          onClick={(event) => guardNavigation(event, "/")}
          className="mt-4 flex w-full items-center gap-3 rounded-lg bg-white/[.07] px-3 py-3 text-left text-xs font-medium text-white"
        >
          <Icon name="grid" size={17} />
          <span>내 스마트 링크</span>
        </a>
        <button
          onClick={startNewLink}
          className="mt-3 flex w-full items-center gap-3 rounded-lg bg-white/[.07] px-3 py-3 text-left text-xs font-medium text-white"
        >
          <Icon name="plus" size={17} />새 링크 만들기
        </button>
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
        <div className="mt-6 flex items-center gap-2 px-2 text-[10px] text-[#666b7c]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6d7e9b]" />
          Smart links studio
        </div>
      </aside>
      <div className="lg:ml-[216px]">
        <header className="flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white px-5 sm:px-9 xl:px-12">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-800 lg:hidden">
              gimoon /
            </span>
            <span>워크스페이스</span>
            <span className="mx-1 text-slate-300">/</span>
            <span className="font-medium text-slate-700">
              {editing ? "스마트 링크 수정" : "새 스마트 링크"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="hidden text-[11px] text-slate-400 sm:inline">
                  {user.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-[11px] text-slate-500 hover:text-rose-600"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <a
                href="/login"
                onClick={(event) => guardNavigation(event, "/login")}
                className="text-[11px] font-medium text-[#5865f2] hover:text-[#404bd2]"
              >
                로그인
              </a>
            )}
            <a
              href="/"
              onClick={(event) => guardNavigation(event, "/")}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-[#5865f2]"
            >
              <Icon name="grid" size={14} />내 스마트 링크
            </a>
          </div>
        </header>
        <main
          id="create"
          className="mx-auto max-w-[1320px] px-5 pt-9 pb-8 sm:px-9 xl:px-12 xl:pt-11"
        >
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-[.14em] text-[#5865f2]">
                {editing ? "EDIT SMART LINK" : "NEW SMART LINK"}
              </p>
              <h1 className="text-[27px] font-bold tracking-[-.045em] sm:text-[30px]">
                {editing ? "스마트 링크 수정" : "하나의 앨범, 하나의 링크."}
              </h1>
              <p className="mt-2.5 text-xs leading-6 text-slate-500 sm:text-[13px]">
                흩어진 음악 플랫폼을 모아, 당신의 음악에 닿는 가장 짧은 길을
                만드세요.
              </p>
            </div>
            {job && (
              <button
                onClick={startNewLink}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:border-slate-300"
              >
                <Icon name="plus" size={15} />
                새로 만들기
              </button>
            )}
          </div>
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_292px] 2xl:gap-10">
            <div className="min-w-0">
              <ol className="mb-6 flex items-center gap-2 sm:gap-3">
                {["앨범 불러오기", "링크 확인", "발행하기"].map(
                  (label, index) => (
                    <li
                      key={label}
                      className="flex min-w-0 flex-1 items-center gap-2 text-[11px] last:flex-none sm:gap-2.5"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${index === step ? "bg-[#5865f2] text-white ring-4 ring-[#5865f2]/[.07]" : index < step ? "bg-[#edf0ff] text-[#5865f2]" : "border border-slate-200 bg-white text-slate-400"}`}
                      >
                        {index < step ? (
                          <Icon name="check" size={13} />
                        ) : (
                          `0${index + 1}`
                        )}
                      </span>
                      <span
                        className={`whitespace-nowrap ${index === step ? "font-semibold text-slate-800" : "text-slate-400"}`}
                      >
                        {label}
                      </span>
                      {index < 2 && (
                        <span className="mx-1 hidden h-px flex-1 bg-slate-200 sm:block" />
                      )}
                    </li>
                  ),
                )}
              </ol>
              <section className="panel p-5 sm:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#5865f2]">
                    <Icon name="link" size={21} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">
                      앨범 주소로 시작하기
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-400">
                      음원 플랫폼의 앨범 상세 주소를 붙여 넣어 주세요.
                    </p>
                  </div>
                </div>
                <form onSubmit={submit}>
                  <label htmlFor="album-url" className="sr-only">
                    앨범 상세 주소
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#fafbfe] px-3.5 transition focus-within:border-[#8490f5] focus-within:bg-white focus-within:ring-3 focus-within:ring-[#5865f2]/[.07]">
                    <Icon
                      name="music"
                      size={18}
                      className="shrink-0 text-slate-400"
                    />
                    <input
                      id="album-url"
                      type="url"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="앨범 링크를 여기에 붙여 넣으세요"
                      className="min-w-0 grow bg-transparent py-4 text-xs outline-none placeholder:text-slate-400 sm:text-[13px]"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Icon name="globe" size={15} />
                      검색 국가
                      <select
                        aria-label="검색 국가"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700"
                      >
                        <option value="KR">한국 (KR)</option>
                        <option value="US">미국 (US)</option>
                        <option value="JP">일본 (JP)</option>
                        <option value="GB">영국 (GB)</option>
                        <option value="DE">독일 (DE)</option>
                      </select>
                    </label>
                    <button disabled={busy} className="primary-button min-w-32">
                      {busy ? (
                        <>
                          <span className="spinner" />
                          검색 중
                        </>
                      ) : (
                        <>
                          앨범 불러오기
                          <Icon name="arrow" size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Icon name="shield" size={12} />
                    음원은 다운로드하지 않으며 앨범 정보와 링크만 조회합니다.
                  </p>
                </div>
              </section>
              {error && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-4 text-xs leading-6 text-red-700"
                >
                  <Icon name="info" size={16} className="mt-1 shrink-0" />
                  {error}
                </div>
              )}
              {busy && (
                <div
                  role="status"
                  className="panel mt-5 flex items-center gap-4 p-6"
                >
                  <span className="spinner text-[#5865f2]" />
                  <div>
                    <p className="text-xs font-semibold">
                      {job?.status === "processing"
                        ? "플랫폼별 앨범을 찾고 있어요"
                        : "검색을 준비하고 있어요"}
                    </p>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      이 탭에서 새로고침해도 검색 결과를 이어서 확인할 수
                      있습니다.
                    </p>
                  </div>
                </div>
              )}
              {album && job?.status === "ready" && (
                <section className="mt-7">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      검색된 플랫폼{" "}
                      <span className="ml-1 text-[#5865f2]">
                        {found.length}
                      </span>
                    </h2>
                    <span className="text-[11px] text-slate-400">
                      플랫폼별로 같은 앨범을 확인해 주세요
                    </span>
                  </div>
                  <div className="space-y-3">
                    {found.map((platform) => (
                      <article
                        key={platform.key}
                        className="panel overflow-hidden"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                          <span className="flex items-center gap-2.5 text-xs font-semibold">
                            <PlatformMark platform={platform.key} small />
                            {platformNames[platform.key]}
                          </span>
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-medium ${platform.status === "source" ? "bg-[#eef0ff] text-[#5865f2]" : "bg-emerald-50 text-emerald-600"}`}
                          >
                            {statusNames[platform.status]}
                          </span>
                        </div>
                        <fieldset className="space-y-2 p-4">
                          <legend className="sr-only">
                            {platformNames[platform.key]} 앨범 선택
                          </legend>
                          {platform.candidates.map((candidate) => (
                            <div
                              key={candidate.id}
                              className={`rounded-lg border p-3 ${selected[platform.key] === candidate.id ? "border-[#aab3fc] bg-[#f6f7ff]" : "border-slate-100"}`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  aria-label={`${candidate.title} — ${candidate.artist}, ${candidate.release_date || "발매일 미확인"}`}
                                  type="radio"
                                  name={platform.key}
                                  checked={
                                    selected[platform.key] === candidate.id
                                  }
                                  onChange={() =>
                                    choose(platform.key, candidate.id)
                                  }
                                  className="mt-0.5 accent-[#5865f2]"
                                />
                                <div className="min-w-0 grow">
                                  <p className="text-xs font-semibold">
                                    {candidate.title}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {candidate.artist} ·{" "}
                                    {candidate.release_date || "발매일 미확인"}
                                  </p>
                                  <p className="mt-2 text-[10px] leading-5 text-slate-400">
                                    {candidate.evidence.join(" · ")}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => copyCandidate(candidate)}
                                    aria-label={`${candidate.title} 주소 복사`}
                                    title={
                                      copiedCandidate === candidate.id
                                        ? "복사했습니다"
                                        : "주소 복사"
                                    }
                                    className="rounded-md p-1 text-slate-400 hover:text-[#5865f2]"
                                  >
                                    <Icon
                                      name={
                                        copiedCandidate === candidate.id
                                          ? "check"
                                          : "copy"
                                      }
                                      size={14}
                                    />
                                  </button>
                                  <a
                                    href={candidate.url}
                                    aria-label={`${platformNames[platform.key]}에서 ${candidate.title} 확인`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-md p-1 text-slate-400 hover:text-[#5865f2]"
                                  >
                                    <Icon name="external" size={14} />
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                          <label className="flex items-center gap-3 px-3 py-1 text-[11px] text-slate-400">
                            <input
                              type="radio"
                              name={platform.key}
                              checked={!selected[platform.key]}
                              onChange={() => choose(platform.key, "")}
                              className="accent-[#5865f2]"
                            />
                            이 플랫폼 제외
                          </label>
                        </fieldset>
                      </article>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-slate-400">
                    UPC가 일치하는 후보를 우선 선택하고, 없으면 첫 번째 후보를
                    선택합니다. 다른 에디션이나 트랙 수가 다른 앨범인지 확인해
                    주세요.
                  </p>
                  {!!unavailable.length && (
                    <div className="panel mt-5">
                      <button
                        onClick={() => setShowUnavailable(!showUnavailable)}
                        aria-expanded={showUnavailable}
                        className="flex w-full items-center justify-between p-5 text-xs font-medium"
                      >
                        <span>
                          추가 확인이 필요한 플랫폼{" "}
                          <span className="ml-1 text-slate-400">
                            {unavailable.length}
                          </span>
                        </span>
                        <Icon
                          name="chevron"
                          size={15}
                          className={`text-slate-400 transition ${showUnavailable ? "rotate-180" : ""}`}
                        />
                      </button>
                      {showUnavailable && (
                        <div className="divide-y divide-slate-100 border-t border-slate-100 px-5">
                          {unavailable.map((platform) => (
                            <div key={platform.key} className="py-3.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">
                                  {platformNames[platform.key]}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {statusNames[platform.status]}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                                {platform.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!!manualLinks.length && (
                    <section className="mt-6" aria-labelledby="added-platforms">
                      <div className="mb-4 flex items-center justify-between">
                        <h2
                          id="added-platforms"
                          className="text-sm font-semibold"
                        >
                          추가된 플랫폼{" "}
                          <span className="ml-1 text-[#5865f2]">
                            {manualLinks.length}
                          </span>
                        </h2>
                        <span className="text-[11px] text-slate-400">
                          직접 등록한 앨범 링크
                        </span>
                      </div>
                      <div className="space-y-2">
                        {manualLinks.map(
                          ({ url, hostname, platformKey, label }) => (
                            <article
                              key={url}
                              className="panel flex items-center gap-3 px-4 py-3"
                            >
                              {platformKey ? (
                                <PlatformMark platform={platformKey} small />
                              ) : (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-500">
                                  ↗
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold">
                                    {label || "직접 등록"}
                                  </p>
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                                    직접 추가
                                  </span>
                                </div>
                                <p className="mt-1 truncate text-[10px] text-slate-400">
                                  {url}
                                </p>
                              </div>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${label} 링크 열기`}
                                className="rounded-md p-1.5 text-slate-400 hover:text-[#5865f2]"
                              >
                                <Icon name="external" size={14} />
                              </a>
                              <button
                                type="button"
                                onClick={() => removeManualLink(url)}
                                aria-label="직접 추가한 주소 삭제"
                                className="rounded-md px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                              >
                                삭제
                              </button>
                            </article>
                          ),
                        )}
                      </div>
                    </section>
                  )}
                  <details className="panel mt-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-xs font-medium">
                      <span className="flex items-center gap-2">
                        <Icon name="plus" size={15} />
                        앨범 링크 직접 추가
                      </span>
                      <Icon
                        name="chevron"
                        size={14}
                        className="text-slate-400"
                      />
                    </summary>
                    <div className="border-t border-slate-100 p-5">
                      <label
                        htmlFor="manual-links"
                        className="text-[11px] leading-6 text-slate-500"
                      >
                        앨범 주소를 입력하고 Enter를 누르거나 추가 버튼을
                        누르세요. 직접 추가한 링크는 자동 검증되지 않습니다.
                      </label>
                      <div className="mt-3 flex gap-2">
                        <input
                          id="manual-links"
                          type="url"
                          value={manualInput}
                          onChange={(event) => {
                            setManualInput(event.target.value);
                            setManualError("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addManualLink();
                            }
                          }}
                          placeholder="https://music.example.com/album/..."
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-[#8490f5]"
                        />
                        <button
                          type="button"
                          onClick={addManualLink}
                          className="rounded-lg bg-[#202431] px-4 text-xs font-medium text-white hover:bg-[#34394a]"
                        >
                          추가
                        </button>
                      </div>
                      {manualError && (
                        <p className="mt-2 text-[11px] text-rose-600">
                          {manualError}
                        </p>
                      )}
                    </div>
                  </details>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dee2ff] bg-[#f0f2ff] p-5">
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-[#5865f2]">
                        {count}개 링크
                      </span>
                      로 페이지를 만들어요
                    </p>
                    <button
                      onClick={publish}
                      disabled={publishing || !count}
                      className="primary-button"
                    >
                      {publishing
                        ? editing
                          ? "저장 중…"
                          : "발행 중…"
                        : editing
                          ? "수정 저장"
                          : "스마트 링크 발행"}
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>
                  {published && (
                    <div
                      role="status"
                      className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
                    >
                      <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                        <Icon name="check" size={16} />
                        스마트 링크가 발행됐습니다
                      </p>
                      <div className="mt-4 flex flex-wrap gap-4">
                        <a
                          href={`/s/${published.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"
                        >
                          페이지 열기
                          <Icon name="external" size={13} />
                        </a>
                        <button
                          onClick={copyLink}
                          className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"
                        >
                          <Icon name={copied ? "check" : "copy"} size={13} />
                          {copied ? "복사했습니다" : "링크 복사"}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
              <section id="platforms" className="mt-7 scroll-mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-slate-600">
                    국내외 플랫폼 연결
                  </h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {currentPlatforms.map((platform) => {
                    const key = platform.key;
                    const mode = platformModes[key] || platform.mode;
                    const liveStatus =
                      platform.status && platform.status !== "source"
                        ? platform.status
                        : null;
                    const status = liveStatus
                      ? {
                          label: statusNames[liveStatus] || "상태 확인",
                          description:
                            liveStatus === "found"
                              ? "앨범 후보를 찾았어요"
                              : liveStatus === "not_found"
                                ? "이번 앨범은 검색되지 않았어요"
                                : liveStatus === "blocked"
                                  ? "서비스 접근이 제한됐어요"
                                  : liveStatus === "rate_limited"
                                    ? "잠시 후 다시 시도해 주세요"
                                    : liveStatus === "error"
                                      ? "검색 중 오류가 발생했어요"
                                      : liveStatus === "unavailable"
                                        ? "서비스에 연결할 수 없어요"
                                        : liveStatus === "credentials_required"
                                          ? "API 연결 설정이 필요해요"
                                          : liveStatus === "disabled"
                                            ? "현재 자동 검색에서 제외했어요"
                                            : liveStatus === "manual_required"
                                              ? "앨범 주소를 직접 추가해요"
                                              : "검색 상태를 확인해 주세요",
                          tone:
                            liveStatus === "found"
                              ? "available"
                              : liveStatus === "disabled"
                                ? "disabled"
                                : ["not_found", "blocked", "error"].includes(
                                      liveStatus,
                                    )
                                  ? "unavailable"
                                  : liveStatus === "manual_required"
                                    ? "manual"
                                    : "setup",
                        }
                      : platformStatusFor(mode);
                    const toneClasses = {
                      available: "bg-emerald-50 text-emerald-700",
                      setup: "bg-amber-50 text-amber-700",
                      manual: "bg-slate-100 text-slate-600",
                      disabled: "bg-rose-50 text-rose-600",
                      unavailable: "bg-rose-50 text-rose-600",
                    };
                    return (
                      <div
                        key={key}
                        className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3"
                      >
                        <PlatformMark platform={key} small />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-700">
                              {platformNames[key]}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${toneClasses[status.tone]}`}
                            >
                              {status.label}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] leading-4 text-slate-400">
                            {status.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <details className="mt-3 text-[10px] leading-6 text-slate-400">
                  <summary className="w-fit cursor-pointer hover:text-slate-600">
                    상태 안내
                  </summary>
                  <p className="mt-1">
                    자동 검색은 앨범에 따라 결과가 없거나 서비스 접근이 제한될
                    수 있습니다. 키 설정 필요 플랫폼은 서버 환경 설정 후 검색할
                    수 있고, 직접 추가는 앨범 주소를 수동으로 등록합니다.
                    Last.fm은 스트리밍 대신 앨범 정보 페이지를 연결합니다.
                  </p>
                </details>
              </section>
              <section
                id="how-it-works"
                className="mt-8 scroll-mt-8 border-t border-slate-200 pt-6"
              >
                <h2 className="mb-4 text-xs font-semibold text-slate-600">
                  이렇게 만들어요
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    [
                      "01",
                      "주소 붙여 넣기",
                      "공유하고 싶은 앨범의 상세 주소를 입력하세요.",
                    ],
                    [
                      "02",
                      "같은 앨범 확인",
                      "아티스트와 앨범 정보를 비교해 링크를 골라 주세요.",
                    ],
                    [
                      "03",
                      "팬에게 공유하기",
                      "발행한 링크 하나로 여러 플랫폼을 연결하세요.",
                    ],
                  ].map(([number, title, description]) => (
                    <div key={number}>
                      <span className="text-[10px] font-semibold text-[#8590d2]">
                        {number}
                      </span>
                      <h3 className="mt-2 text-xs font-medium text-slate-700">
                        {title}
                      </h3>
                      <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                        {description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <AlbumPreview
              album={album}
              links={previewLinks}
              published={published}
            />
          </div>
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-[10px] text-slate-400">
            <span>© {new Date().getFullYear()} gimoon studio</span>
            <span>Made for your next release.</span>
          </footer>
        </main>
        {leavePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-5 backdrop-blur-[2px]">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-title"
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h2
                id="leave-title"
                className="text-base font-semibold text-slate-900"
              >
                {leavePrompt.type === "new"
                  ? "새 링크를 시작할까요?"
                  : "페이지를 나갈까요?"}
              </h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                {leavePrompt.type === "new"
                  ? "현재 초안은 임시 저장되어 있습니다. 새 링크를 시작하면 입력 내용이 초기화됩니다."
                  : "작성 중인 내용은 임시 저장됩니다. 이 페이지를 나가시겠어요?"}
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLeavePrompt(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  계속 작성
                </button>
                <button
                  type="button"
                  onClick={confirmLeave}
                  className="rounded-lg bg-[#5865f2] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#4854db]"
                >
                  {leavePrompt.type === "new" ? "새 링크 시작" : "나가기"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
