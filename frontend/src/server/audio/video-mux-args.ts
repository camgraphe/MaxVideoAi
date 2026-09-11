/** Pad short audio with silence; only the video stream defines the final duration. */
export function buildVideoPreservingMuxArgs(sourcePath: string, audioPath: string, outputPath: string): string[] {
  return ['-y', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm',
    '-i', sourcePath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-af', 'apad', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest', outputPath];
}
