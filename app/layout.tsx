import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TEF A1–B2 法语词汇闪卡自测",
  description: "按等级与主题练习 TEF 法语词汇，并在同一账号的设备间同步答题进度。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
