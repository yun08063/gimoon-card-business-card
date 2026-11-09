"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { api } from "@/lib/smartlinks";

export default function SavedPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [smartlink, setSmartlink] = useState(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setOrigin(window.location.origin);
    api(`smartlinks/${slug}/`)
      .then(setSmartlink)
      .catch(() => setError("저장된 스마트 링크를 불러오지 못했습니다."));
  }, [slug]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(`${origin}/s/${slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("주소를 복사하지 못했습니다. 주소를 직접 선택해 주세요.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-14 text-[#202431]">
      <section className="w-full max-w-3xl text-center">
        {smartlink ? (
          <div className="relative mx-auto h-40 w-40">
            {smartlink.album.cover ? (
              <img
                src={smartlink.album.cover}
                alt={`${smartlink.album.title} 앨범 커버`}
                referrerPolicy="no-referrer"
                className="h-full w-full rounded-xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Icon name="music" size={48} />
              </div>
            )}
            <span className="absolute -right-4 bottom-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-300 text-slate-950 shadow-lg">
              <Icon name="check" size={34} className="stroke-[3]" />
            </span>
          </div>
        ) : (
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
            {error ? (
              <Icon name="info" size={36} />
            ) : (
              <span className="spinner" />
            )}
          </div>
        )}

        <h1 className="mt-12 text-3xl font-semibold tracking-tight sm:text-4xl">
          스마트 링크가 저장됐어요
        </h1>
        {smartlink && (
          <p className="mt-3 text-sm text-slate-500">
            {smartlink.album.artist} · {smartlink.album.title}
          </p>
        )}

        <div className="mt-12 flex flex-col overflow-hidden rounded-lg sm:flex-row">
          <input
            aria-label="저장된 스마트 링크 주소"
            readOnly
            value={origin && slug ? `${origin}/s/${slug}` : ""}
            onFocus={(event) => event.target.select()}
            className="min-w-0 flex-1 bg-slate-100 px-4 py-4 text-left text-sm outline-none sm:text-base"
          />
          <button
            type="button"
            onClick={copyUrl}
            disabled={!smartlink}
            className="flex items-center justify-center gap-2 bg-emerald-300 px-8 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60 sm:min-w-56"
          >
            <Icon name={copied ? "check" : "copy"} size={17} />
            {copied ? "복사 완료" : "URL 복사"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-600">
            {error}
          </p>
        )}

        <nav className="mt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          <a
            href={`/s/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm transition hover:border-slate-500"
          >
            <Icon name="play" size={17} /> 공개 페이지 보기
          </a>
          <button
            type="button"
            onClick={() => router.push(`/create?edit=${slug}`)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm transition hover:border-slate-500"
          >
            <Icon name="link" size={17} /> 수정하기
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm transition hover:border-slate-500"
          >
            <Icon name="grid" size={17} /> 내 스마트 링크
          </a>
        </nav>
      </section>
    </main>
  );
}
