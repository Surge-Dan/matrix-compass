import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "矩阵罗盘｜创作者经营实验室";
const description = "本地优先的内容、日程、收入与经营复盘工作台。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const imageUrl = `${origin}/og.png`;

  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      title,
      description,
      images: [{ url: imageUrl, width: 1792, height: 920, alt: "矩阵罗盘创作者经营实验室" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
