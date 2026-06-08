import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { AuditStrip } from "./components/audit-strip";
import { Nav } from "./components/nav";
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
      <body>
        <div className="flex min-h-dvh">
          <Nav />
          <div className="flex min-w-0 flex-1 flex-col">
            <AuditStrip />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
