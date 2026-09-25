"""Build social images from verified captures of the public production site.

Run with ``python3 frontend/scripts/generate-social-cards.py`` from the repo root.
The JPEG sources in ``social-card-sources`` were captured on 2026-09-25 from:

- https://maxvideoai.com/ (the real video player, paused, and the home hero)
- https://maxvideoai.com/models
- https://maxvideoai.com/ai-video-engines
- https://maxvideoai.com/pricing

The crops show only the relevant public page sections and exclude the account
header. Never draw a simulated control or substitute a mockup for a capture.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SCRIPT_DIR = Path(__file__).resolve().parent
SOURCE_DIR = SCRIPT_DIR / "social-card-sources"
OUTPUT_DIR = SCRIPT_DIR.parent / "public" / "og"
VERSION = "2026-09-25"
SIZE = (1200, 630)
PAPER = "#f7f5f2"
INK = "#242422"


def font(size: int) -> ImageFont.FreeTypeFont:
    for path in (
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size)
    raise FileNotFoundError("Arial Bold or DejaVu Sans Bold is required")


def source(name: str, expected_size: tuple[int, int]) -> Image.Image:
    path = SOURCE_DIR / f"{name}-{VERSION}.jpg"
    with Image.open(path) as captured:
        if captured.size != expected_size:
            raise ValueError(f"Unexpected capture size for {path}: {captured.size}")
        return captured.convert("RGB")


def save(name: str, image: Image.Image) -> None:
    output = OUTPUT_DIR / f"{name}-{VERSION}.png"
    image.save(output, optimize=True)
    print(output, output.stat().st_size)


def player_card(name: str, title: str) -> None:
    image = Image.new("RGB", SIZE, PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((30, 22), "MaxVideoAI", font=font(26), fill=INK)
    draw.text((263, 19), title, font=font(30), fill=INK)
    player = source("home-player", (1193, 555))
    player.thumbnail((1140, 530), Image.Resampling.LANCZOS)
    image.paste(player, (30, 82))
    save(name, image)


def page_card(name: str, source_name: str | None = None) -> None:
    capture = source(source_name or name, (1256, 630))
    capture.thumbnail((1140, 572), Image.Resampling.LANCZOS)
    image = Image.new("RGB", SIZE, PAPER)
    image.paste(capture, ((SIZE[0] - capture.width) // 2, (SIZE[1] - capture.height) // 2))
    save(name, image)


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    page_card("brand", "home-overview")
    player_card("home", "AI video. Pay as you go.")
    for page in ("models", "compare", "pricing"):
        page_card(page)
