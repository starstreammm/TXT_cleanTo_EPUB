from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

COVER_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "temp" / "cover"
COVER_PATH.mkdir(parents=True, exist_ok=True)
TEMPLATE = Path(__file__).resolve().parent.parent / "cover.jpg"
FONT = Path(__file__).resolve().parent.parent / "NotoSansSC.ttf"
MAX_WIDTH = 1033
LINE_SPACING = 13


def generate_cover(
    uid: str,
    title: str,
    author: str | None = None,
):
    output = COVER_PATH / f"{uid}.jpg"

    image = Image.open(TEMPLATE).convert("RGB")
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.truetype(str(FONT), 113)
    author_font = ImageFont.truetype(str(FONT), 80)

    def draw_centered(text: str, font, center_y: int):
        lines = []
        line = ""

        for char in text:
            test = line + char
            box = draw.textbbox((0, 0), test, font=font)

            if box[2] - box[0] > MAX_WIDTH and line:
                lines.append(line)
                line = char
            else:
                line = test

        if line:
            lines.append(line)

        line_height = font.getbbox("国")[3] - font.getbbox("国")[1]
        total_height = line_height * len(lines)

        y = center_y - total_height / 2

        for i, line in enumerate(lines):
            box = draw.textbbox((0, 0), line, font=font)
            text_width = box[2] - box[0]

            x = (image.width - text_width) / 2

            draw.text(
                (x, y),
                line,
                fill="black",
                font=font,
            )

            if i < len(lines) - 1:
                y += line_height + LINE_SPACING

    draw_centered(title, title_font, 500)

    if author:
        draw_centered(author, author_font, 1900)

    image.save(output, quality=95)


if __name__ == "__main__":
    generate_cover("test", "测试标题测试标题测试标题测试标题", "作者名")
