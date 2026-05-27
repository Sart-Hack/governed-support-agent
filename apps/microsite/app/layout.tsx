import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { siteMetadata } from "./metadata";
import "./globals.css";

export const metadata = siteMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
