import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrowNext Super Admin",
  description: "Administrative console for managing users and permissions across GrowNext apps."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
