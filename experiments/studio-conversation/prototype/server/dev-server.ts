import {
  createServer,
  normalizePath,
  mergeConfig,
  type InlineConfig,
} from "vite";
import { resolve } from "node:path";

export function createStudioVite(dataRoot: string, config: InlineConfig = {}) {
  return createServer(
    mergeConfig(
      {
        server: {
          middlewareMode: true,
          fs: {
            deny: [
              ".env",
              ".env.*",
              "*.{crt,pem,key,p12,pfx,cer,der}",
              ".npmrc",
              ".yarnrc.yml",
              "**/.git/**",
              "**/.data/**",
              normalizePath(resolve(dataRoot)) + "/**",
            ],
          },
        },
        appType: "spa",
      },
      config,
    ),
  );
}
