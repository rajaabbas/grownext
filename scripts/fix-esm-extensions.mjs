#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const [,, targetDir = "dist"] = process.argv;

const IMPORT_PATTERN =
  /(from\s+['"])(\.{1,2}\/[^'"\s]+)(['"])/g;
const EXPORT_PATTERN =
  /(export\s+(?:\*\s+from|{[^}]*}\s+from)\s+['"])(\.{1,2}\/[^'"\s]+)(['"])/g;
const DYNAMIC_IMPORT_PATTERN =
  /(import\(\s*['"])(\.{1,2}\/[^'"\s]+)(['"]\s*\))/g;

const hasExtension = (specifier) =>
  /\.[a-zA-Z0-9]+$/.test(specifier);

const appendExtension = (specifier) =>
  hasExtension(specifier) ? specifier : `${specifier}.js`;

const processFile = async (filePath) => {
  const source = await fs.readFile(filePath, "utf8");
  const updated = source
    .replace(IMPORT_PATTERN, (_, start, spec, end) => `${start}${appendExtension(spec)}${end}`)
    .replace(EXPORT_PATTERN, (_, start, spec, end) => `${start}${appendExtension(spec)}${end}`)
    .replace(DYNAMIC_IMPORT_PATTERN, (_, start, spec, end) => `${start}${appendExtension(spec)}${end}`);

  if (updated !== source) {
    await fs.writeFile(filePath, updated, "utf8");
  }
};

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts"))) {
        await processFile(fullPath);
      }
    })
  );
};

const run = async () => {
  const absoluteTarget = path.resolve(process.cwd(), targetDir);
  try {
    const stats = await fs.stat(absoluteTarget);
    if (!stats.isDirectory()) {
      return;
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  await walk(absoluteTarget);
};

run().catch((error) => {
  console.error("[fix-esm-extensions] failed:", error);
  process.exitCode = 1;
});
