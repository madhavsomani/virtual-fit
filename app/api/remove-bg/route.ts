import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;
    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save input to temp file
    const id = randomUUID();
    const inputPath = join("/tmp", `tryon-input-${id}.png`);
    const outputPath = join("/tmp", `tryon-output-${id}.png`);
    await writeFile(inputPath, buffer);

    // Run rembg to remove background
    await new Promise<void>((resolve, reject) => {
      exec(`rembg i "${inputPath}" "${outputPath}"`, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(`rembg failed: ${stderr || err.message}`));
        else resolve();
      });
    });

    // Read output and return as base64 data URL
    const outputBuffer = await readFile(outputPath);
    const base64 = outputBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    // Cleanup temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    return NextResponse.json({ success: true, imageUrl: dataUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
