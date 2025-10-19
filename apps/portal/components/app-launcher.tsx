import Link from "next/link";
import type { PortalLauncherProduct } from "@ma/contracts";

interface AppLauncherProps {
  products: PortalLauncherProduct[];
}

export function AppLauncher({ products }: AppLauncherProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {products.map((product) => (
        <Link
          key={product.productId}
          href={product.launchUrl}
          className="group rounded-2xl border border-slate-800 bg-slate-950/60 p-6 transition hover:border-fuchsia-500 hover:bg-slate-900/80"
        >
          <div className="flex items-center justify-between">
          <div className="flex size-10 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold uppercase text-slate-100">
            {product.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.iconUrl}
                alt={`${product.name} icon`}
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <span>{product.name.slice(0, 2)}</span>
            )}
          </div>
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
