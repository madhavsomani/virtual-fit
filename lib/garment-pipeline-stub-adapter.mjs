import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const stubAdapter = {
  name: "stub",
  async generate({ garmentId, sourceImageUrl, outputAbsPath }) {
    void sourceImageUrl;

    await mkdir(dirname(outputAbsPath), { recursive: true });

    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12, 8);

    await writeFile(outputAbsPath, header);

    return { outputAssetUrl: `/garments/${garmentId}.glb` };
  }
};
