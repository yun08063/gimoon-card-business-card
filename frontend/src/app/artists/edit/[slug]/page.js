"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import ArtistPageView from "@/components/ArtistPageView";
import WorkspaceShell from "@/components/WorkspaceShell";
import { api, csrfHeaders } from "@/lib/smartlinks";

const emptyLink = () => ({ title: "", platform: "website", url: "" });
const linkTypes = [
  ["website", "웹사이트"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["x", "X"],
  ["spotify", "Spotify"],
  ["soundcloud", "SoundCloud"],
  ["other", "기타"],
];

export default function ArtistEditorPage() {
  const { slug } = useParams();
  const router = useRouter();
  const creating = slug === "new";
  const [form, setForm] = useState({
    name: "",
    slug: "",
    bio: "",
    location: "",
    is_published: true,
    links: [],
  });
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [user, setUser] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(!creating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const account = await api("auth/me/");
        if (active) setUser(account.user);
        if (creating) return;
        const artist = await api(`artists/${slug}/`);
        if (!active) return;
        setForm({
          name: artist.name,
          slug: artist.slug,
          bio: artist.bio,
          location: artist.location,
          is_published: artist.is_published,
          links: artist.links,
        });
        setImageUrl(artist.image_url || "");
      } catch {
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [creating, router, slug]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateLink(index, field, value) {
    setForm((current) => ({
      ...current,
      links: current.links.map((link, currentIndex) =>
        currentIndex === index ? { ...link, [field]: value } : link,
      ),
    }));
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const payload = new FormData();
    payload.set("name", form.name.trim());
    if (form.slug.trim()) payload.set("slug", form.slug.trim());
    payload.set("bio", form.bio.trim());
    payload.set("location", form.location.trim());
    payload.set("is_published", String(form.is_published));
    payload.set(
      "links",
      JSON.stringify(
        form.links
          .filter((link) => link.title.trim() && link.url.trim())
          .map((link, position) => ({ ...link, position })),
      ),
    );
    if (imageFile) payload.set("image", imageFile);
    if (removeImage) payload.set("remove_image", "true");

    try {
      const result = await api(creating ? "artists/" : `artists/${slug}/`, {
        method: creating ? "POST" : "PATCH",
        headers: await csrfHeaders(),
        body: payload,
      });
      router.push(result.is_published ? `/artist/${result.slug}` : "/");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "아티스트 페이지를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  const artistPreview = {
    name: form.name,
    bio: form.bio,
    location: form.location,
    image_url: removeImage ? "" : imagePreviewUrl || imageUrl,
    links: form.links.filter((link) => link.title.trim() && link.url.trim()),
  };

  if (loading) {
    return (
      <WorkspaceShell
        active="library"
        title={creating ? "아티스트 명함 만들기" : "아티스트 명함 수정"}
        user={user}
      >
        <div className="grid min-h-[50vh] place-items-center text-xs text-slate-400">
          페이지를 불러오는 중…
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      active="library"
      title={creating ? "아티스트 명함 만들기" : "아티스트 명함 수정"}
      user={user}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <form onSubmit={save} className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[.16em] text-[#5865f2]">
            {creating ? "NEW ARTIST PAGE" : "EDIT ARTIST PAGE"}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {creating ? "나를 소개하는 페이지 만들기" : "아티스트 페이지 수정"}
          </h1>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            소개와 이미지를 올리고, 팬에게 보여줄 링크를 추가하세요.
          </p>
          <section className="panel mt-6 space-y-5 p-5 sm:p-7">
            <label className="block">
              <span className="text-xs font-medium">아티스트명</span>
              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="활동명을 입력하세요"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#8490f5]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium">페이지 주소</span>
              <div className="mt-2 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm">
                <span className="shrink-0 text-slate-400">/artist/</span>
                <input
                  value={form.slug}
                  onChange={(event) => updateField("slug", event.target.value)}
                  placeholder="저장할 때 자동 생성"
                  pattern="[A-Za-z0-9_-]+"
                  className="min-w-0 flex-1 bg-transparent px-1 py-3 outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium">자기소개</span>
              <textarea
                maxLength={2000}
                rows={5}
                value={form.bio}
                onChange={(event) => updateField("bio", event.target.value)}
                placeholder="음악과 활동에 대해 소개해 주세요."
                className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-[#8490f5]"
              />
              <span className="mt-1 block text-right text-[10px] text-slate-400">
                {form.bio.length}/2000
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-medium">활동 지역</span>
              <input
                maxLength={120}
                value={form.location}
                onChange={(event) =>
                  updateField("location", event.target.value)
                }
                placeholder="예: 서울, 대한민국"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#8490f5]"
              />
            </label>

            <div>
              <span className="text-xs font-medium">프로필 이미지</span>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {(imageFile || imageUrl) && !removeImage ? (
                  <img
                    src={imagePreviewUrl || imageUrl}
                    alt="프로필 미리보기"
                    className="h-24 w-24 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-[#eef0ff] text-[#5865f2]">
                    <Icon name="music" size={28} />
                  </div>
                )}
                <div className="flex flex-col items-start gap-2">
                  <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">
                    이미지 선택
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          setError("이미지는 5MB 이하로 올려 주세요.");
                          return;
                        }
                        setImageFile(file);
                        setRemoveImage(false);
                        setError("");
                      }}
                    />
                  </label>
                  {(imageFile || imageUrl) && !removeImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setRemoveImage(true);
                      }}
                      className="text-[11px] text-rose-600"
                    >
                      이미지 제거
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400">
                    JPG, PNG, WebP, GIF · 최대 5MB
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel mt-4 p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">홍보 링크</h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  음악, SNS, 공연 일정, 굿즈 스토어 등을 추가하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateField("links", [...form.links, emptyLink()])
                }
                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50"
              >
                <Icon name="plus" size={14} /> 추가
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {form.links.map((link, index) => (
                <div
                  key={link.id || index}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={link.platform}
                      onChange={(event) =>
                        updateLink(index, "platform", event.target.value)
                      }
                      aria-label="링크 종류"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    >
                      {linkTypes.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      maxLength={120}
                      value={link.title}
                      onChange={(event) =>
                        updateLink(index, "title", event.target.value)
                      }
                      placeholder="링크에 표시할 이름"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      aria-label="링크 삭제"
                      onClick={() =>
                        updateField(
                          "links",
                          form.links.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        )
                      }
                      className="rounded-lg px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Icon name="plus" size={15} className="rotate-45" />
                    </button>
                  </div>
                  <input
                    required
                    type="url"
                    value={link.url}
                    onChange={(event) =>
                      updateLink(index, "url", event.target.value)
                    }
                    placeholder="https://"
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs"
                  />
                </div>
              ))}
              {!form.links.length && (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                  아직 링크가 없습니다. 홍보할 링크를 추가해 주세요.
                </p>
              )}
            </div>
          </section>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) =>
                updateField("is_published", event.target.checked)
              }
              className="mt-0.5 accent-[#5865f2]"
            />
            <span>
              <span className="block text-xs font-medium">페이지 공개</span>
              <span className="mt-1 block text-[11px] text-slate-500">
                공개하면 누구나 주소를 통해 이 페이지를 볼 수 있습니다.
              </span>
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <a
              href="/"
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-600"
            >
              취소
            </a>
            <button type="submit" disabled={saving} className="primary-button">
              {saving ? "저장 중…" : "페이지 저장"}
              <Icon name="arrow" size={14} />
            </button>
          </div>
        </form>
        <aside className="xl:sticky xl:top-[92px] xl:h-[calc(100dvh-136px)] xl:min-h-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-600">
              공개 페이지 미리보기
            </h2>
          </div>
          <div className="h-[min(68dvh,720px)] min-h-[400px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_36px_-20px_rgba(32,42,70,0.25)] xl:h-full">
            <ArtistPageView artist={artistPreview} preview />
          </div>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
