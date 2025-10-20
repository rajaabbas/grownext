import type { ReactNode } from "react";

const UnauthenticatedLayout = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
    <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
      {children}
    </div>
  </main>
);

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return <UnauthenticatedLayout>{children}</UnauthenticatedLayout>;
}
