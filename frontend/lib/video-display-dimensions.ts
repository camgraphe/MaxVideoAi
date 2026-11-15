type VideoDisplayStream = {
  width?: number;
  height?: number;
  side_data_list?: Array<{ rotation?: number }>;
  tags?: { rotate?: string };
};

/** FFprobe reports coded dimensions; a display matrix takes precedence over legacy tags. */
export function getVideoDisplayDimensions(stream: VideoDisplayStream | undefined) {
  const matrixRotation = stream?.side_data_list?.find(entry => Number.isFinite(entry.rotation))?.rotation;
  const rotation = matrixRotation ?? Number(stream?.tags?.rotate ?? 0);
  const normalized = ((rotation % 360) + 360) % 360;
  const swap = Math.abs(normalized - 90) < 0.01 || Math.abs(normalized - 270) < 0.01;
  const width = Number(stream?.width), height = Number(stream?.height);
  return { width: swap ? height : width, height: swap ? width : height };
}
