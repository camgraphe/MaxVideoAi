import { canonicalMediaAssetFields } from "@/lib/media-identity";

export type ImageLibraryAsset = {
  assetId: string;
  url: string;
  thumbUrl?: string | null;
  name?: string;
};
export type RecentImage = {
  id: string;
  jobId: string;
  url: string;
  thumbUrl?: string | null;
  status: string;
};
/** Reuse the library save owner; obtain its canonical public identity from the owned asset reader. */
export async function saveRecentImageReference(
  output: RecentImage,
  request: typeof fetch = fetch,
): Promise<ImageLibraryAsset> {
  const saved = await request("/api/media-library/save-output", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: output.jobId, outputId: output.id }),
  });
  const result = await saved.json();
  if (!saved.ok || !result.ok || !result.asset?.url)
    throw new Error(
      "Impossible de retrouver cette création dans votre bibliothèque.",
    );
  const response = await request(
    `/api/media-library/assets?kind=image&originUrl=${encodeURIComponent(result.asset.url)}`,
    { cache: "no-store" },
  );
  const payload = await response.json();
  const asset = payload.assets?.find(
    (item: ImageLibraryAsset) =>
      canonicalMediaAssetFields(item.assetId, "image").assetId,
  );
  if (!response.ok || !payload.ok || !asset)
    throw new Error(
      "La référence enregistrée est momentanément indisponible. Réessayez.",
    );
  return asset;
}
