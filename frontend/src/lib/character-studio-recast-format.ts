export const RECAST_RESOLUTIONS = ['480p', '720p', '1080p'] as const;
export const RECAST_FRAMINGS = ['auto', '9:16', '16:9', '1:1', '3:4', '4:3'] as const;
export type RecastResolution = (typeof RECAST_RESOLUTIONS)[number];
export type RecastFraming = (typeof RECAST_FRAMINGS)[number];
