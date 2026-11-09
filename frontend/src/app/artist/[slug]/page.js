import { notFound } from "next/navigation";
import ArtistPageView from "@/components/ArtistPageView";

async function getArtist(slug) {
  const response = await fetch(
    `${process.env.API_INTERNAL_URL || "http://localhost:8000"}/api/artists/${encodeURIComponent(slug)}/`,
    { cache: "no-store" },
  );
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("아티스트 페이지를 불러오지 못했습니다.");
  return response.json();
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  return {
    title: `${artist.name} | GIMOON`,
    description: artist.bio || `${artist.name}의 아티스트 페이지`,
    openGraph: {
      title: artist.name,
      description: artist.bio,
      images: artist.image_url ? [artist.image_url] : [],
    },
  };
}

export default async function ArtistPublicPage({ params }) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  return <ArtistPageView artist={artist} />;
}
