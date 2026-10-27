export const platformNames = {
  melon: "멜론",
  genie: "지니",
  bugs: "벅스",
  // Keep the retired label so previously published pages remain readable.
  vibe: "VIBE",
  flo: "FLO",
  spotify: "Spotify",
  apple: "Apple Music",
  deezer: "Deezer",
  tidal: "TIDAL",
  youtube: "YouTube Music",
  amazon: "Amazon Music",
  soundcloud: "SoundCloud",
  lastfm: "Last.fm",
};

export const platformStatus = {
  automatic: {
    label: "자동 검색",
    description: "앨범 후보를 자동으로 찾아요",
    tone: "available",
  },
  setup: {
    label: "설정 필요",
    description: "API 연결 설정 후 자동 검색해요",
    tone: "setup",
  },
  manual: {
    label: "직접 추가",
    description: "앨범 주소를 직접 등록할 수 있어요",
    tone: "manual",
  },
  excluded: {
    label: "검색 제외",
    description: "자동 검색 결과에 포함하지 않아요",
    tone: "disabled",
  },
};

export function platformStatusFor(mode) {
  if (mode === "disabled" || mode === "search_excluded") {
    return platformStatus.excluded;
  }
  if (mode === "manual") return platformStatus.manual;
  if (mode === "credentials") return platformStatus.setup;
  return platformStatus.automatic;
}

export async function api(path, init) {
  const response = await fetch(`/api/${path}`, init);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (!response.ok) {
    const message =
      typeof body.detail === "string"
        ? body.detail
        : Object.values(body).flat().join(" ");
    throw new Error(message || "요청을 처리하지 못했습니다.");
  }
  return body;
}

export async function csrfHeaders(headers = {}) {
  const { csrfToken } = await api("auth/csrf/");
  return { ...headers, "X-CSRFToken": csrfToken };
}
