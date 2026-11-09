"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import ArtistPageView from "@/components/ArtistPageView";
import SmartLinkPageView from "@/components/SmartLinkPageView";
import WorkspaceShell from "@/components/WorkspaceShell";
import { api } from "@/lib/smartlinks";

const previewAlbum = {
  title: "앨범 제목",
  artist: "아티스트 이름",
  url: "#",
  platform: "flo",
  cover: "",
};

const previewLinks = [
  { platform: "flo", url: "#" },
  { platform: "youtube", url: "#" },
];

function SmartLinkPreview() {
  return (
    <div className="mb-6 flex h-[min(50dvh,440px)] justify-center overflow-hidden rounded-xl border border-slate-200 bg-[#e9edf5] shadow-sm">
      <div className="h-[880px] w-[400px] shrink-0 origin-top scale-50">
        <SmartLinkPageView
          album={previewAlbum}
          links={previewLinks}
          design="classic"
          preview
        />
      </div>
    </div>
  );
}

function ArtistPagePreview() {
  const artist = {
    name: "아티스트 이름",
    bio: "음악과 활동을 소개하는 문구가 여기에 표시됩니다.",
    location: "서울, 대한민국",
    image_url: "",
    links: [
      { id: "music", title: "음악 듣기", url: "#" },
      { id: "instagram", title: "Instagram", url: "#" },
    ],
  };

  return (
    <div className="mb-6 h-[min(50dvh,440px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="h-dvh w-[200%] origin-top-left scale-50">
        <ArtistPageView artist={artist} preview />
      </div>
    </div>
  );
}

export default function ChooseLinkTypePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api("auth/me/")
      .then((account) => {
        if (active) setUser(account.user);
      })
      .catch(() => router.replace("/login"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <WorkspaceShell active="create" title="새 링크 만들기" user={user}>
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="text-[10px] font-semibold tracking-[.16em] text-[#5865f2]">
          CREATE A PAGE
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          어떤 페이지를 만들까요?
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          만들 페이지 종류를 선택해 시작하세요.
        </p>

        {loading ? (
          <div className="panel mt-7 p-10 text-center text-xs text-slate-400">
            로그인 상태를 확인하는 중…
          </div>
        ) : (
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <article className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-[#aab3fc] hover:shadow-lg hover:shadow-[#5865f2]/[.06] sm:p-7">
              <SmartLinkPreview />
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#5865f2]">
                <Icon name="link" size={20} />
              </span>
              <h2 className="mt-5 text-base font-semibold text-slate-900">
                스마트 링크
              </h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                앨범 주소 하나로 여러 음원 플랫폼의 링크를 한 페이지에 모아요.
              </p>
              <button
                type="button"
                onClick={() => router.push("/create?new=1")}
                className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#5865f2]"
              >
                앨범 링크 만들기 <Icon name="arrow" size={14} />
              </button>
            </article>

            <article className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-[#aab3fc] hover:shadow-lg hover:shadow-[#5865f2]/[.06] sm:p-7">
              <ArtistPagePreview />
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef0ff] text-[#5865f2]">
                <Icon name="music" size={20} />
              </span>
              <h2 className="mt-5 text-base font-semibold text-slate-900">
                아티스트 명함
              </h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                자기소개, 이미지, SNS와 홍보 링크를 한 페이지에 담아요.
              </p>
              <button
                type="button"
                onClick={() => router.push("/artists/edit/new")}
                className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#5865f2]"
              >
                아티스트 페이지 만들기 <Icon name="arrow" size={14} />
              </button>
            </article>
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
