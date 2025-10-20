import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { vi } from "vitest";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children)
}));
