"""Prepare and serve the isolated design prototype; no application API calls."""

import argparse
import shutil
import subprocess
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def prepare_preview():
    source = Path(__file__).resolve().parent
    root = source.parents[2]
    output = root / ".superpowers/sdd/global-app-concept/prototype"
    assets = output / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        str(root / "node_modules/.bin/tsx"), "--tsconfig", str(root / "frontend/tsconfig.json"),
        str(source / "export-catalog.ts"), str(output / "catalog.generated.js"),
    ], cwd=root, check=True)
    for name in ("index.html", "app.css", "app.js", "data.js", "model-choice.js", "reference-choice.js", "recent-media.js"):
        shutil.copyfile(source / name, output / name)
    authored_assets = {
        "openai-mark-light.svg": "frontend/public/brand/partners/openai/openai-mark-light.svg",
        "openai-mark-dark.svg": "frontend/public/brand/partners/openai/openai-mark-dark.svg",
        "claude-mark-light.svg": "frontend/public/brand/partners/anthropic/claude-mark-light.svg",
        "claude-mark-dark.svg": "frontend/public/brand/partners/anthropic/claude-mark-dark.svg",
        "logo-mark.svg": "frontend/public/assets/branding/logo-mark.svg",
        "GeistLatin.woff2": "frontend/app/(core)/_fonts/GeistLatin.woff2",
        "OFL.txt": "frontend/app/(core)/_fonts/OFL.txt",
        "cartographer.png": "frontend/public/assets/model-examples/minimax-h3/reference/cartographer-one.png",
        "campaign.webp": "frontend/public/assets/model-examples/nano-banana-pro/campaign.webp",
        "hero.webp": "frontend/public/assets/model-examples/seedream-5-0-pro/hero.webp",
        "product.webp": "frontend/public/assets/model-examples/luma-uni-1-max/hero-product.webp",
        "ambience.wav": "frontend/public/assets/model-examples/minimax-h3/reference/station-ambience.wav",
        "demo.mp4": "frontend/public/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4",
    }
    for name, relative in authored_assets.items():
        shutil.copyfile(root / relative, assets / name)
    shutil.copyfile(source / "video-poster.jpg", assets / "video-poster.jpg")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=3025)
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    output = prepare_preview()
    if args.prepare_only:
        print(output)
    else:
        handler = partial(SimpleHTTPRequestHandler, directory=str(output))
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
        print(f"Prototype local : http://localhost:{args.port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
