import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TOURNAMENT_NAME } from "@/lib/tournament";

export const metadata: Metadata = {
  title: { default: TOURNAMENT_NAME, template: `%s | ${TOURNAMENT_NAME}` },
  description: "A new season. Your next innings. Register for Pudur Premier League and follow the players, squads, pools, and live cricket auction.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#103c32",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
