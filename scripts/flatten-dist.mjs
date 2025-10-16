#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const [, , target = "dist"] = process.argv;

const moveEntry = async (sourcePath, destinationPath) => {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    if (error && error.code === "EXDEV") {
      await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
      await fs.rm(sourcePath, { recursive: true, force: true });
      return;
    }

    if (error && error.code === "EEXIST") {
      await fs.rm(destinationPath, { recursive: true, force: true });
      await fs.rename(sourcePath, destinationPath);
      return;
    }

    throw error;
  }
};

const flattenDist = async (distDir) => {
  let stats;
  try {
    stats = await fs.stat(distDir);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    return;
  }

  const nestedDir = path.join(distDir, "src");
  let nestedStats;
  try {
    nestedStats = await fs.stat(nestedDir);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  if (!nestedStats.isDirectory()) {
    return;
  }

  const entries = await fs.readdir(nestedDir);
  await Promise.all(
    entries.map(async (entry) => {
      const fromPath = path.join(nestedDir, entry);
      const toPath = path.join(distDir, entry);
      await moveEntry(fromPath, toPath);
    })
  );

  await fs.rm(nestedDir, { recursive: true, force: true });
};

flattenDist(path.resolve(process.cwd(), target)).catch((error) => {
  console.error("[flatten-dist] failed:", error);
  process.exitCode = 1;
});
