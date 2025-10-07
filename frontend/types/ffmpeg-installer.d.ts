declare module '@ffmpeg-installer/ffmpeg' {
  const ffmpegInstaller: {
    path: string;
    version?: string;
    url?: string;
  };
  export default ffmpegInstaller;
  export const path: string;
}
