import { notFound } from "next/navigation";
import SmartLinkPageView from "@/components/SmartLinkPageView";
async function getLink(slug) {
  if (!/^[0-9a-f-]{36}$/i.test(slug)) notFound();
  const response = await fetch(
    `${process.env.API_INTERNAL_URL || "http://localhost:8000"}/api/smartlinks/${slug}/`,
    { cache: "no-store" },
  );
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("스마트 링크를 불러오지 못했습니다.");
  return response.json();
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { album } = await getLink(slug);
  return {
    title: `${album.artist} — ${album.title} | GIMOON`,
    description: `${album.title}을 원하는 음원 플랫폼에서 들어보세요.`,
    openGraph: {
      title: `${album.artist} — ${album.title}`,
      images: album.cover ? [album.cover] : [],
    },
  };
}
export default async function SmartLinkPage({ params }) {
  const { slug } = await params;
  const { album, links, design = "classic" } = await getLink(slug);
  return <SmartLinkPageView album={album} links={links} design={design} />;
}
