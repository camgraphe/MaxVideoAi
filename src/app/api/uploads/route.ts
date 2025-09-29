import { NextResponse } from "next/server";
import { generatePresignedUpload } from "@/lib/storage/presign";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const filename = typeof body?.filename === "string" ? body.filename : undefined;
    const contentType = typeof body?.contentType === "string" ? body.contentType : undefined;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 },
      );
    }

    const upload = await generatePresignedUpload({ filename, contentType });

    return NextResponse.json({
      uploadUrl: upload.post.url,
      fields: upload.post.fields,
      fileUrl: upload.fileUrl,
      key: upload.key,
    });
  } catch (error) {
    console.error("Upload presign failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to presign upload" },
      { status: 500 },
    );
  }
}
