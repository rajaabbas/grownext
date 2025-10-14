import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tasks",
  description: "Simple tenant-aware task tracker example"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-100`}>
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
