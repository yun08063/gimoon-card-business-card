"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { GimoonBrand } from "@/components/Brand";
import { api } from "@/lib/smartlinks";

const libraryKey = "gimoon-smartlink-library";

async function claimPreviousLinks() {
  const saved = JSON.parse(localStorage.getItem(libraryKey) || "[]");
  try {
    const draft = JSON.parse(
      sessionStorage.getItem("gimoon-smartlink-draft") || "null",
    );
    if (draft?.id && draft?.token) saved.push(draft);
  } catch {}
  const tokens = [...new Set(saved.map((item) => item.token).filter(Boolean))];
  if (!tokens.length) return;
  const csrf = await api("auth/csrf/");
  await api("auth/claim/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrf.csrfToken,
      "X-Edit-Tokens": tokens.join(","),
    },
    body: JSON.stringify({}),
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("auth/config/")
      .then((result) => setGoogleAvailable(result.googleAvailable))
      .catch(() => {});
    api("auth/me/")
      .then(() => router.replace("/library"))
      .catch(() => {});
    const google = new URLSearchParams(window.location.search).get("google");
    if (google === "not-configured")
      setError("Google 로그인이 아직 설정되지 않았습니다.");
    else if (google && google !== "success")
      setError("Google 로그인에 실패했습니다. 다시 시도해 주세요.");
    else if (google === "success") {
      claimPreviousLinks()
        .catch(() => {})
        .finally(() => router.replace("/library"));
    }
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const csrf = await api("auth/csrf/");
      const result = await api(
        `auth/${mode === "login" ? "login" : "register"}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrf.csrfToken,
          },
          body: JSON.stringify({ email, password }),
        },
      );
      await claimPreviousLinks();
      if (!result.user) throw new Error("로그인 응답을 확인할 수 없습니다.");
      router.replace("/library");
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-5 py-10 text-[#202431]">
      <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_20px_70px_-45px_rgba(25,35,65,.3)] sm:p-9">
        <GimoonBrand href="/" className="mx-auto text-xl tracking-tighter" />
        <h1 className="mt-8 text-center text-xl font-bold tracking-tight text-slate-900">
          {mode === "login" ? "다시 오셨네요" : "계정 만들기"}
        </h1>
        <p className="mt-2 text-center text-xs text-slate-500">
          로그인하고 스마트 링크를 한곳에서 관리하세요.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700"
          >
            {error}
          </p>
        )}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-medium text-slate-600">
            이메일
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#8490f5]"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            비밀번호
            <input
              type="password"
              required
              minLength={mode === "login" ? 1 : 8}
              maxLength={16}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#8490f5]"
              placeholder={mode === "login" ? "비밀번호" : "8~16자"}
            />
            {mode === "register" && (
              <span className="mt-1.5 block text-[10px] text-slate-400">
                8자 이상 16자 이하로 입력해 주세요.
              </span>
            )}
          </label>
          <button
            disabled={busy}
            className="primary-button w-full justify-center"
          >
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3 text-[10px] text-slate-400">
          <span className="h-px flex-1 bg-slate-100" />
          또는
          <span className="h-px flex-1 bg-slate-100" />
        </div>
        <a
          href={googleAvailable ? "/api/auth/google/start/" : "#"}
          onClick={(event) => {
            if (!googleAvailable) event.preventDefault();
          }}
          aria-disabled={!googleAvailable}
          className={`flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${googleAvailable ? "border-[#cbd4ff] bg-[#f7f8ff] text-slate-800 shadow-[0_4px_14px_-10px_rgba(88,101,242,.65)] hover:border-[#8792ff] hover:bg-[#eef0ff] hover:shadow-[0_8px_20px_-12px_rgba(88,101,242,.8)]" : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 48 48"
            className="h-5 w-5 shrink-0"
          >
            <path
              fill="#4285F4"
              d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6l6.6 5.1c3.9-3.6 6.1-8.8 6.1-14.8Z"
            />
            <path
              fill="#EA4335"
              d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.8-6.8C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2c1.9-5.7 7.2-9.9 13.4-9.9Z"
            />
            <path
              fill="#FBBC05"
              d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l8-6.2Z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.5 0 12-2.1 16-5.8l-6.6-5.1c-1.8 1.2-4.3 2-7.4 2-6.2 0-11.5-4.2-13.4-9.9l-8 6.2C6.5 43 14.6 48 24 48Z"
            />
          </svg>
          Google 계정으로 계속하기
        </a>
        {!googleAvailable && (
          <p className="mt-2 text-center text-[10px] text-slate-400">
            관리자가 Google OAuth를 설정하면 사용할 수 있습니다.
          </p>
        )}
        <p className="mt-6 text-center text-xs text-slate-500">
          {mode === "login" ? "처음이신가요?" : "이미 계정이 있나요?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            className="font-semibold text-[#5865f2] hover:underline"
          >
            {mode === "login" ? "회원가입" : "로그인"}
          </button>
        </p>
      </section>
    </main>
  );
}
