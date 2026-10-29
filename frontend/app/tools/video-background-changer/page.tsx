import { notFound } from 'next/navigation';
import { VideoBackgroundChangerPage } from './_components/VideoBackgroundChangerPage';
import { buildVideoBackgroundMetadata, getPublishedVideoBackgroundMedia } from './_lib/page-data';

export const generateMetadata = buildVideoBackgroundMetadata;

export default function VideoBackgroundChangerRoute() {
  const media = getPublishedVideoBackgroundMedia();
  if (!media) notFound();
  return <VideoBackgroundChangerPage media={media} />;
}
