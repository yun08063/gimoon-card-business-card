"use client";
export default function Error({ reset }) {
  return (
    <main className="p-16 text-center">
      <h1 className="text-2xl">지금은 링크를 불러오지 못했어요.</h1>
      <button onClick={reset} className="mt-6 underline">
        다시 시도
      </button>
    </main>
  );
}
