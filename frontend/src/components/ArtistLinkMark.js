import {
  siInstagram,
  siSoundcloud,
  siSpotify,
  siTiktok,
  siX,
  siYoutube,
} from "simple-icons";
import Icon from "@/components/Icon";

const marks = {
  instagram: { icon: siInstagram, color: "#E4405F" },
  youtube: { icon: siYoutube, color: "#FF0000" },
  tiktok: { icon: siTiktok, color: "#111111" },
  x: { icon: siX, color: "#111111" },
  spotify: { icon: siSpotify, color: "#1DB954" },
  soundcloud: { icon: siSoundcloud, color: "#FF5500" },
};

export default function ArtistLinkMark({ platform }) {
  const mark = marks[platform];

  if (!mark) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f2ff] text-[#5865f2]">
        <Icon name={platform === "website" ? "globe" : "external"} size={16} />
      </span>
    );
  }

  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: mark.color }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="white"
        aria-hidden="true"
      >
        <path d={mark.icon.path} />
      </svg>
    </span>
  );
}
