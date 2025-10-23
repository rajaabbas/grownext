#!/usr/bin/env node
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

const [, , targetDir = "dist"] = process.argv;

const IMPORT_PATTERN = /(from\s+['"])(\.{1,2}\/[^'"\s]+)(['"])/g;
const EXPORT_PATTERN =
  /(export\s+(?:\*\s+from|{[^}]*}\s+from)\s+['"])(\.{1,2}\/[^'"\s]+)(['"])/g;
const DYNAMIC_IMPORT_PATTERN =
  /(import\(\s*['"])(\.{1,2}\/[^'"\s]+)(['"]\s*\))/g;

const hasExtension = (specifier) => /\.[a-zA-Z0-9]+$/.test(specifier);

const withIndex = (specifier) => (specifier.endsWith("/") ? `${specifier}index.js` : `${specifier}/index.js`);

const resolveSpecifier = (filePath, specifier) => {
  if (hasExtension(specifier)) {
    return specifier;
  }

  const baseDir = path.dirname(filePath);
  const withJs = `${specifier}.js`;
  const resolvedWithJs = path.resolve(baseDir, withJs);

  if (fs.existsSync(resolvedWithJs)) {
    return withJs;
  }

  const indexPath = withIndex(specifier);
  const resolvedWithIndex = path.resolve(baseDir, indexPath);
  if (fs.existsSync(resolvedWithIndex)) {
    return indexPath;
  }

  return withJs;
};

const transformSource = (filePath, source) =>
  source
    .replace(IMPORT_PATTERN, (_, start, spec, end) => `${start}${resolveSpecifier(filePath, spec)}${end}`)
    .replace(EXPORT_PATTERN, (_, start, spec, end) => `${start}${resolveSpecifier(filePath, spec)}${end}`)
    .replace(DYNAMIC_IMPORT_PATTERN, (_, start, spec, end) => `${start}${resolveSpecifier(filePath, spec)}${end}`);

const processFile = async (filePath) => {
  const source = await fsPromises.readFile(filePath, "utf8");
  const updated = transformSource(filePath, source);

  if (updated !== source) {
    await fsPromises.writeFile(filePath, updated, "utf8");
  }
};

const walk = async (dir) => {
  const entries = await fsPromises.readdir(dir, { withFileTypes: true });
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
    const stats = await fsPromises.stat(absoluteTarget);
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

