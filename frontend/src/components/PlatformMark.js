import {
  siApplemusic,
  siDeezer,
  siLastdotfm,
  siSoundcloud,
  siSpotify,
  siTidal,
  siYoutubemusic,
} from "simple-icons";
import Icon from "./Icon";

const localLogos = {
  melon: "/platform-logos/melon.jpg",
  genie: "/platform-logos/genie.jpg",
  bugs: "/platform-logos/bugs.png",
  // Keep the mark for old public links created before the service retires.
  vibe: "/platform-logos/vibe.jpg",
  flo: "/platform-logos/flo.jpg",
  amazon: "/platform-logos/amazon.jpg",
};

const brandIcons = {
  spotify: siSpotify,
  apple: siApplemusic,
  deezer: siDeezer,
  tidal: siTidal,
  youtube: siYoutubemusic,
  soundcloud: siSoundcloud,
  lastfm: siLastdotfm,
};

export default function PlatformMark({ platform, small = false }) {
  const size = small ? 20 : 28;
  const logo = localLogos[platform];
  const brand = brandIcons[platform];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/70 bg-white ${small ? "h-7 w-7" : "h-10 w-10"}`}
    >
      {logo ? (
        <img
          src={logo}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : brand ? (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={`#${brand.hex}`}
          aria-hidden="true"
        >
          <path d={brand.path} />
        </svg>
      ) : (
        <Icon name="music" size={size} className="text-slate-500" />
      )}
    </span>
  );
}
