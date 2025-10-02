process.env.DATABASE_URL ??= "postgres://debug:debug@localhost:5432/debug";
process.env.FAL_KEY ??= "debug-key";
process.env.APP_URL ??= "https://example.com";

async function main() {
  const falModule = await import("../../src/providers/fal");
  const { extractFalVideoResourceFromPayload, mapFalPollResponse } = falModule;

  type FalPayload = Parameters<typeof mapFalPollResponse>[1];

  interface TestCase {
    name: string;
    payload: FalPayload;
  }

  const basePayload: FalPayload = {
    request_id: "test",
    status: "completed",
  };

  const cases: TestCase[] = [
    {
      name: "response.video_url",
      payload: {
        ...basePayload,
        response: {
          video_url: "https://fal.example/video.mp4",
          duration: 8,
          thumbnails: ["https://fal.example/thumb.jpg"],
        },
      },
    },
    {
      name: "videos[0].signed_url",
      payload: {
        ...basePayload,
        videos: [
          {
            signed_url: "https://fal.example/signed.webm",
            thumbnail_url: "https://fal.example/thumb2.jpg",
            duration_seconds: 6,
          },
        ],
      },
    },
    {
      name: "outputs array with file.download_url",
      payload: {
        ...basePayload,
        outputs: [
          {
            file: {
              download_url: "https://fal.example/download.mov",
            },
            preview_url: "https://fal.example/preview.png",
            seconds: 10,
          },
        ],
      },
    },
    {
      name: "payload.video_url top-level",
      payload: {
        ...basePayload,
        video_url: "https://fal.example/top-level.mp4",
        thumbnails: ["https://fal.example/top-thumb.jpg"],
        duration: 12,
      },
    },
    {
      name: "no video",
      payload: {
        ...basePayload,
        status: "running",
      },
    },
  ];

  console.log("FAL payload extraction diagnostics\n");
  const rows = cases.map((test) => {
    const asset = extractFalVideoResourceFromPayload(test.payload);
    const mapped = mapFalPollResponse(test.payload.request_id, test.payload, true);
    return {
      case: test.name,
      status: mapped.status,
      outputUrl: mapped.outputUrl ?? "<none>",
      thumbnail: mapped.thumbnailUrl ?? "<none>",
      duration: mapped.durationSeconds ?? "<unknown>",
      assetUrl: asset?.url ?? "<none>",
    };
  });

  console.table(rows);
}

void main();
