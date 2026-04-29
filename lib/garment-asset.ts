import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";

/**
 * Checks whether a generated mesh binary really exists on disk.
 *
 * This is intentionally stricter than `hasAsset()` in `garment-library.ts`.
 * `hasAsset()` validates the catalog path contract, while `hasMesh()` verifies
 * that `/public/garments/<id>.glb` is present and at least large enough to hold
 * the VF-9 placeholder glTF header.
 *
 * @param garmentId Garment identifier.
 * @param opts Optional repository root override for tests and scripts.
 * @returns True when the file exists and is at least 12 bytes.
 */
export async function hasMesh(garmentId: string, opts: { rootDir?: string } = {}): Promise<boolean> {
  const meshPath = resolve(opts.rootDir ?? process.cwd(), "public", "garments", `${garmentId}.glb`);

  try {
    await access(meshPath, fsConstants.F_OK);
    const details = await stat(meshPath);
    return details.size >= 12;
  } catch {
    return false;
  }
}
