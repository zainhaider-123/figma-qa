import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export function isVercelBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function streamFile(url: string): Promise<NextResponse> {
  if (isVercelBlobUrl(url)) {
    const result = await get(url, { access: "private" });
    if (result?.statusCode !== 200) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
      },
    });
  }

  try {
    new URL(url);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const response = await fetch(url);
  if (!response.ok) {
    return new NextResponse("Failed to fetch file", { status: 502 });
  }

  const contentType =
    response.headers.get("content-type") || "application/octet-stream";
  const body = response.body;
  if (!body) {
    return new NextResponse("Empty response", { status: 502 });
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
    },
  });
}

async function handleRequest(
  _request: Request,
  imageUrl: string | null,
): Promise<NextResponse> {
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json(
      { error: "imageUrl is required" },
      { status: 400 },
    );
  }

  return streamFile(imageUrl);
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("imageUrl");

  return handleRequest(request, imageUrl);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { imageUrl?: string };

  return handleRequest(request, body.imageUrl ?? null);
}
