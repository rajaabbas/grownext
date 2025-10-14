import Link from "next/link";
import type { LauncherProduct } from "@/lib/mock-data";

interface AppLauncherProps {
  products: LauncherProduct[];
}

export function AppLauncher({ products }: AppLauncherProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {products.map((product) => (
        <Link
          key={product.id}
          href={product.url}
          className="group rounded-2xl border border-slate-800 bg-slate-950/60 p-6 transition hover:border-fuchsia-500 hover:bg-slate-900/80"
        >
          <div className="flex items-center justify-between">
            <span className="text-3xl">{product.icon}</span>
            <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs uppercase tracking-wide text-fuchsia-200">
              {product.roles.join(" · ")}
            </span>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-white">{product.name}</h3>
          <p className="mt-2 text-sm text-slate-400">{product.description}</p>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Launch</span>
            {product.lastUsedAt && (
              <span>
                Last used {new Date(product.lastUsedAt).toLocaleString()}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
