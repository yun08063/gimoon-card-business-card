"use client";
import { useEffect, useState } from "react";
import { api, csrfHeaders, platformNames } from "@/lib/smartlinks";
const storageKey = "gimoon-smartlink-draft";
const libraryKey = "gimoon-smartlink-library";

export default function useSmartLink() {
  const [url, setUrl] = useState("");
  const [country, setCountry] = useState("KR");
  const [session, setSession] = useState(null);
  const [job, setJob] = useState(null);
  const [selected, setSelected] = useState({});
  const [manual, setManual] = useState("");
  const [design, setDesign] = useState("classic");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(null);
  const [copied, setCopied] = useState(false);
  const [platforms, setPlatforms] = useState([]);
  const [library, setLibrary] = useState([]);
  const [editing, setEditing] = useState(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  async function refreshLibrary() {
    if (!user) return [];
    setLibraryBusy(true);
    setLibraryError("");
    try {
      const saved = JSON.parse(localStorage.getItem(libraryKey) || "[]");
      const valid = saved.filter(
        (item) => typeof item.id === "string" && typeof item.token === "string",
      );
      const result = await api("smartlinks/mine/", {
        headers: { "X-Edit-Tokens": valid.map((item) => item.token).join(",") },
      });
      setLibrary(result);
      return result;
    } catch (e) {
      setLibraryError(
        e instanceof Error ? e.message : "목록을 불러오지 못했습니다.",
      );
    } finally {
      setLibraryBusy(false);
    }
  }
  function rememberPublished(link, capability) {
    if (capability) {
      try {
        const saved = JSON.parse(localStorage.getItem(libraryKey) || "[]");
        const next = saved.filter((item) => item.id !== capability.id);
        next.push(capability);
        localStorage.setItem(libraryKey, JSON.stringify(next));
      } catch {
        setLibraryError("이 브라우저에 편집 권한을 저장하지 못했습니다.");
      }
    }
    setPublished(link);
    try {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Ignore unavailable browser storage. */
    }
    refreshLibrary();
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    api("resolutions/platforms/")
      .then((result) => {
        if (active) setPlatforms(result);
      })
      .catch(() => {
        if (active)
          setPlatforms(
            Object.keys(platformNames).map((key) => ({
              key,
              mode: key === "spotify" ? "disabled" : "manual",
            })),
          );
      });
    return () => {
      active = false;
    };
  }, [user]);
  useEffect(() => {
    let active = true;
    api("auth/me/")
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    try {
      if (new URLSearchParams(window.location.search).get("new") === "1") {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(storageKey);
        window.history.replaceState({}, "", "/create");
        return;
      }
      const saved =
        localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
      if (saved) {
        const value = JSON.parse(saved);
        if (typeof value.url === "string") setUrl(value.url);
        if (typeof value.country === "string") setCountry(value.country);
        if (typeof value.manual === "string") setManual(value.manual);
        if (value.design === "classic" || value.design === "split")
          setDesign(value.design);
        if (value.selected && typeof value.selected === "object")
          setSelected(value.selected);
        if (typeof value.id === "string" && typeof value.token === "string")
          setSession(value);
      }
    } catch {
      /* A draft can still be used without browser storage. */
    }
  }, [user]);
  useEffect(() => {
    if (published || (!session && !url.trim() && !job)) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...(session ? { id: session.id, token: session.token } : {}),
          url,
          country,
          manual,
          selected,
          design,
        }),
      );
    } catch {
      /* Draft recovery is optional when browser storage is unavailable. */
    }
  }, [country, design, job, manual, published, selected, session, url]);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let timer;
    let failures = 0;
    const started = Date.now();
    async function poll() {
      try {
        const result = await api(`resolutions/${session.id}/`, {
          headers: { "X-Edit-Token": session.token },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        failures = 0;
        setJob(result);
        if (result.status === "ready") {
          const defaults = {};
          result.result.platforms?.forEach((platform) => {
            const exact = platform.candidates.find(
              (c) =>
                c.match_status === "source" || c.match_status === "matched",
            );
            const first = exact || platform.candidates[0];
            if (first) defaults[platform.key] = first.id;
          });
          setSelected((current) => ({ ...defaults, ...current }));
          setBusy(false);
          return;
        }
        if (result.status === "failed") {
          setError(result.error);
          setBusy(false);
          return;
        }
        setBusy(true);
        if (Date.now() - started > 180_000) {
          setError(
            "검색이 지연되고 있습니다. 잠시 후 페이지를 새로고침해 주세요.",
          );
          setBusy(false);
          return;
        }
        timer = setTimeout(poll, 2000);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (++failures < 3) {
          timer = setTimeout(poll, 3000);
          return;
        }
        setError(
          e instanceof Error ? e.message : "검색 결과를 가져오지 못했습니다.",
        );
        setBusy(false);
      }
    }
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [session]);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    setPublished(null);
    setEditing(null);
    setJob(null);
    setSelected({});
    setSession(null);
    setManual("");
    setDesign("classic");
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ url: url.trim(), country }),
      );
    } catch {
      /* Draft recovery is optional when browser storage is unavailable. */
    }
    try {
      const result = await api("resolutions/", {
        method: "POST",
        headers: await csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ url: url.trim(), country }),
      });
      const current = { id: result.id, token: result.edit_token };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(current));
      } catch {
        /* Optional storage. */
      }
      setJob(result);
      setSession(current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색을 시작하지 못했습니다.");
      setBusy(false);
    }
  }
  async function publish() {
    if (!session && !editing) return;
    setError("");
    setPublishing(true);
    try {
      const result = await api(
        editing
          ? `smartlinks/${editing.smartlink.slug}/edit/`
          : `resolutions/${session.id}/publish/`,
        {
          method: editing ? "PUT" : "POST",
          headers: await csrfHeaders({
            "Content-Type": "application/json",
            ...(session?.token ? { "X-Edit-Token": session.token } : {}),
          }),
          body: JSON.stringify({
            candidate_ids: Object.values(selected).filter(Boolean),
            manual_urls: manual
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            design,
          }),
        },
      );
      rememberPublished(result, session);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "발행하지 못했습니다.");
    } finally {
      setPublishing(false);
    }
  }
  useEffect(() => {
    if (user) refreshLibrary();
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const slug = new URLSearchParams(window.location.search).get("edit");
    if (slug) editLink(slug);
  }, [user]);
  async function copyLink() {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/s/${published.slug}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("복사하지 못했습니다. 아래 링크를 열어 주소를 복사해 주세요.");
    }
  }

  async function editLink(slug) {
    setLibraryError("");
    try {
      const saved = JSON.parse(localStorage.getItem(libraryKey) || "[]");
      const rows = await refreshLibrary();
      const capability = saved.find((item) =>
        rows?.some(
          (link) => link.slug === slug && item.id === link.resolution_id,
        ),
      );
      const result = await api(`smartlinks/${slug}/editor/`, {
        headers: capability?.token ? { "X-Edit-Token": capability.token } : {},
      });
      setEditing({ capability, smartlink: result.smartlink });
      setDesign(result.smartlink.design || "classic");
      setJob(result.resolution);
      setSession(capability);
      setSelected(
        Object.fromEntries(
          result.smartlink.links
            .filter((link) => link.verification !== "manual")
            .map((link) => {
              const candidate = result.resolution.result.platforms
                .flatMap((platform) => platform.candidates)
                .find(
                  (item) =>
                    item.platform === link.platform && item.url === link.url,
                );
              return [link.platform, candidate?.id || ""];
            })
            .filter(([, id]) => id),
        ),
      );
      setManual(
        result.smartlink.links
          .filter((link) => link.verification === "manual")
          .map((link) => link.url)
          .join("\n"),
      );
      setPublished(result.smartlink);
      setError("");
      window.history.replaceState({}, "", `/create?edit=${slug}`);
      document.getElementById("create")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      setLibraryError(
        e instanceof Error ? e.message : "링크를 불러오지 못했습니다.",
      );
    }
  }

  async function deleteLink(link) {
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
      setLibrary((current) =>
        current.filter((item) => item.slug !== link.slug),
      );
      if (published?.slug === link.slug) setPublished(null);
    } catch (e) {
      setLibraryError(e instanceof Error ? e.message : "삭제하지 못했습니다.");
    }
  }

  async function signOut() {
    try {
      const csrf = await api("auth/csrf/");
      await api("auth/logout/", {
        method: "POST",
        headers: { "X-CSRFToken": csrf.csrfToken },
      });
      setUser(null);
      setSession(null);
      setJob(null);
      setLibrary([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그아웃하지 못했습니다.");
    }
  }

  function resetDraft() {
    setSession(null);
    setJob(null);
    setUrl("");
    setManual("");
    setSelected({});
    setDesign("classic");
    setError("");
    setPublished(null);
    setEditing(null);
    setBusy(false);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/create");
    }
    try {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
    } catch {}
  }
  return {
    url,
    setUrl,
    country,
    setCountry,
    job,
    selected,
    setSelected,
    manual,
    setManual,
    design,
    setDesign,
    error,
    busy,
    publishing,
    published,
    setPublished,
    copied,
    platforms,
    library,
    editing,
    libraryBusy,
    libraryError,
    user,
    authLoading,
    submit,
    publish,
    copyLink,
    resetDraft,
    refreshLibrary,
    editLink,
    deleteLink,
    signOut,
    setEditing,
  };
}
