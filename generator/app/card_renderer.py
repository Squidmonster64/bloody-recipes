"""Deterministic two-page A4 Bloody Dave recipe card renderer."""
from __future__ import annotations

import io
from pathlib import Path

import qrcode
from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from .config import settings
from .models import RecipeDraft

CREAM = (0.969, 0.957, 0.929)  # #F7F4ED
WHITE = (1.0, 0.992, 0.988)  # #FFFDFC
ORANGE = (0.894, 0.278, 0.075)  # #E44713
GREEN = (0.306, 0.478, 0.169)  # #4E7A2B
DARK = (0.173, 0.153, 0.137)  # #2C2723


class CardRenderError(Exception):
    def __init__(self, message: str, overflows: list[str] | None = None):
        super().__init__(message)
        self.overflows = overflows or []


def _register_fonts() -> tuple[str, str]:
    regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if Path(regular).exists():
        pdfmetrics.registerFont(TTFont("BDSans", regular))
        pdfmetrics.registerFont(TTFont("BDSans-Bold", bold))
        return "BDSans", "BDSans-Bold"
    return "Helvetica", "Helvetica-Bold"


def _wrap(c: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> list[str]:
    words = (text or "").split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _draw_paragraph(c: canvas.Canvas, text: str, x: float, y: float, width: float, font: str, size: float, leading: float, max_lines: int | None = None) -> tuple[float, bool]:
    lines = _wrap(c, text, font, size, width)
    overflow = False
    if max_lines is not None and len(lines) > max_lines:
        overflow = True
        lines = lines[:max_lines]
    c.setFont(font, size)
    c.setFillColorRGB(*DARK)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y, overflow


def _fit_lines(
    c: canvas.Canvas,
    text: str,
    font: str,
    width: float,
    sizes: tuple[float, ...],
    max_lines: int,
) -> tuple[list[str], float, bool]:
    """Find the largest font size that keeps all text inside max_lines."""
    for size in sizes:
        lines = _wrap(c, text, font, size, width)
        if len(lines) <= max_lines:
            return lines, size, False
    size = sizes[-1]
    return _wrap(c, text, font, size, width), size, True


def _draw_fitted_paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font: str,
    sizes: tuple[float, ...],
    max_lines: int,
    leading_factor: float = 1.25,
) -> tuple[float, bool]:
    lines, size, overflow = _fit_lines(c, text, font, width, sizes, max_lines)
    if overflow:
        lines = lines[:max_lines]
    c.setFont(font, size)
    c.setFillColorRGB(*DARK)
    leading = size * leading_factor
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y, overflow


def _ingredient_strip_text(
    c: canvas.Canvas,
    recipe: RecipeDraft,
    *,
    font: str,
    size: float,
    width: float,
    max_lines: int = 2,
) -> str:
    """Return a compact page-one summary that is guaranteed to fit.

    Page two carries the complete BUY/PANTRY lists, so the page-one strip should
    progressively shorten rather than fail the entire recipe on long ingredient
    names.
    """

    def build(buy_count: int, pantry_count: int) -> str:
        parts: list[str] = []
        if recipe.buy:
            parts.append("BUY: " + " · ".join(recipe.buy[:buy_count]))
        if recipe.pantry and pantry_count:
            parts.append("PANTRY: " + " · ".join(recipe.pantry[:pantry_count]))
        return "   |   ".join(parts)

    for buy_count, pantry_count in (
        (6, 4),
        (5, 3),
        (4, 2),
        (3, 2),
        (3, 1),
        (2, 1),
        (1, 1),
    ):
        text = build(buy_count, pantry_count)
        if text and len(_wrap(c, text, font, size, width)) <= max_lines:
            return text

    # The full lists remain on page two; never make a decorative summary block
    # a hard QA failure.
    return "Full BUY + PANTRY ingredient list on page 2."


def _ingredient_list_size(
    c: canvas.Canvas,
    recipe: RecipeDraft,
    *,
    font: str,
    width: float,
    available_height: float,
) -> tuple[float, float, bool]:
    """Choose one readable font size that keeps the complete ingredient lists visible."""
    for size in (9.0, 8.5, 8.0, 7.5, 7.0, 6.5):
        leading = size * 1.25
        line_count = sum(len(_wrap(c, f"• {item}", font, size, width)) for item in recipe.buy)
        line_count += sum(len(_wrap(c, f"• {item}", font, size, width)) for item in recipe.pantry)
        heading_space = 8 * mm if recipe.pantry else 0
        if line_count * leading + heading_space <= available_height:
            return size, leading, False
    return 6.5, 6.5 * 1.25, True


def render_card(
    recipe: RecipeDraft,
    *,
    recipe_id: str,
    hero_path: Path,
    logo_path: Path,
    dest: Path,
) -> tuple[Path, list[str]]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    regular, bold = _register_fonts()
    overflows: list[str] = []
    width, height = A4
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    # Page 1
    c.setFillColorRGB(*CREAM)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    if logo_path.exists():
        c.drawImage(str(logo_path), 18 * mm, height - 28 * mm, width=22 * mm, height=22 * mm, mask="auto", preserveAspectRatio=True, anchor="c")

    c.setFillColorRGB(*ORANGE)
    c.setFont(bold, 11)
    c.drawString(45 * mm, height - 16 * mm, "BLOODY DAVE'S RECIPES")
    c.setFillColorRGB(*DARK)

    title_lines, title_size, title_overflow = _fit_lines(
        c,
        recipe.title,
        bold,
        width - 40 * mm,
        (22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12),
        3,
    )
    if title_overflow:
        overflows.append("title")
        title_lines = title_lines[:3]
    y = height - 40 * mm
    c.setFont(bold, title_size)
    title_leading = max(title_size * 1.2, 6 * mm)
    for line in title_lines:
        c.drawString(18 * mm, y, line)
        y -= title_leading

    if recipe.subtitle:
        y, over = _draw_fitted_paragraph(
            c,
            recipe.subtitle,
            18 * mm,
            y - 2 * mm,
            width - 36 * mm,
            regular,
            (11, 10.5, 10, 9.5, 9),
            2,
        )
        if over:
            overflows.append("subtitle")
    meta = "  ·  ".join(
        p
        for p in [
            recipe.cuisine,
            f"Prep {recipe.prep_time}" if recipe.prep_time else "",
            f"Cook {recipe.cook_time}" if recipe.cook_time else "",
            f"Ready {recipe.total_time}" if recipe.total_time else "",
            f"Serves {recipe.serves}" if recipe.serves else "",
        ]
        if p
    )
    c.setFillColorRGB(*GREEN)
    c.setFont(bold, 10)
    c.drawString(18 * mm, y - 4 * mm, meta[:120])
    y = y - 12 * mm
    if recipe.hook:
        y, over = _draw_fitted_paragraph(
            c,
            recipe.hook,
            18 * mm,
            y,
            width - 36 * mm,
            regular,
            (10, 9.5, 9, 8.5, 8),
            3,
        )
        if over:
            overflows.append("hook")

    hero_top = y - 4 * mm
    hero_bottom = 42 * mm
    hero_height = max(80 * mm, hero_top - hero_bottom)
    if hero_path.exists():
        c.drawImage(
            str(hero_path),
            18 * mm,
            hero_bottom,
            width=width - 36 * mm,
            height=hero_height,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )
    else:
        c.setFillColorRGB(0.95, 0.9, 0.85)
        c.rect(18 * mm, hero_bottom, width - 36 * mm, hero_height, fill=1, stroke=0)

    # Ingredient strip: this is a compact summary only. The full list is on page 2,
    # so progressively shorten it rather than failing QA on long ingredient names.
    c.setFillColorRGB(*WHITE)
    c.roundRect(18 * mm, 14 * mm, width - 36 * mm, 24 * mm, 6, fill=1, stroke=0)
    strip_width = width - 44 * mm
    strip = _ingredient_strip_text(
        c,
        recipe,
        font=regular,
        size=8,
        width=strip_width,
        max_lines=2,
    )
    _draw_paragraph(c, strip, 22 * mm, 28 * mm, strip_width, regular, 8, 10, max_lines=2)

    c.showPage()

    # Page 2
    c.setFillColorRGB(*CREAM)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColorRGB(*DARK)
    c.setFont(bold, 14)
    c.drawString(18 * mm, height - 18 * mm, "Ingredients")
    c.drawString(115 * mm, height - 18 * mm, "Notes")

    y_left = height - 26 * mm
    c.setFont(bold, 10)
    c.setFillColorRGB(*ORANGE)
    c.drawString(18 * mm, y_left, "BUY")
    y_left -= 6 * mm
    c.setFillColorRGB(*DARK)

    ingredient_bottom = height - 110 * mm
    ingredient_size, ingredient_leading, list_overflow = _ingredient_list_size(
        c,
        recipe,
        font=regular,
        width=85 * mm,
        available_height=y_left - ingredient_bottom,
    )
    if list_overflow:
        overflows.append("ingredient_lists")

    for item in recipe.buy:
        y_left, _ = _draw_paragraph(
            c,
            f"• {item}",
            18 * mm,
            y_left,
            85 * mm,
            regular,
            ingredient_size,
            ingredient_leading,
            max_lines=None,
        )

    if recipe.pantry:
        c.setFont(bold, 10)
        c.setFillColorRGB(*GREEN)
        c.drawString(18 * mm, y_left - 2 * mm, "PANTRY")
        y_left -= 8 * mm
        c.setFillColorRGB(*DARK)
        for item in recipe.pantry:
            y_left, _ = _draw_paragraph(
                c,
                f"• {item}",
                18 * mm,
                y_left,
                85 * mm,
                regular,
                ingredient_size,
                ingredient_leading,
                max_lines=None,
            )

    if y_left < ingredient_bottom:
        overflows.append("ingredient_lists")

    y_right = height - 26 * mm
    note = f"Allergens: {recipe.allergens}\n\nNutrition: {recipe.nutrition_display or recipe.nutrition}"
    y_right, over = _draw_fitted_paragraph(
        c,
        note,
        115 * mm,
        y_right,
        75 * mm,
        regular,
        (9, 8.5, 8, 7.5, 7),
        12,
    )
    if over:
        overflows.append("notes")

    # 3x2 method panels
    grid_top = height - 120 * mm
    panel_w = (width - 42 * mm) / 2
    panel_h = 38 * mm
    for idx, stage in enumerate(recipe.method):
        col = idx % 2
        row = idx // 2
        x = 18 * mm + col * (panel_w + 6 * mm)
        y = grid_top - row * (panel_h + 5 * mm)
        c.setFillColorRGB(*WHITE)
        c.roundRect(x, y - panel_h, panel_w, panel_h, 5, fill=1, stroke=0)
        c.setFillColorRGB(*ORANGE)
        c.setFont(bold, 12)
        c.drawString(x + 3 * mm, y - 7 * mm, str(idx + 1))
        c.setFillColorRGB(*DARK)
        c.setFont(bold, 9)
        c.drawString(x + 10 * mm, y - 7 * mm, stage.heading[:40])
        _, over = _draw_fitted_paragraph(
            c,
            stage.directions,
            x + 3 * mm,
            y - 13 * mm,
            panel_w - 6 * mm,
            regular,
            (8.5, 8, 7.5, 7, 6.5),
            5,
        )
        if over:
            overflows.append(f"method_{idx + 1}")

    # Footer
    footer_y = 28 * mm
    c.setFillColorRGB(*ORANGE)
    c.setFont(bold, 10)
    c.drawString(18 * mm, footer_y + 10 * mm, "BIG FLAVOUR. NO WORRIES.")
    c.setFillColorRGB(*DARK)
    c.setFont(regular, 8)
    c.drawString(18 * mm, footer_y + 4 * mm, "info@bloodydaves.com")
    c.drawString(18 * mm, footer_y - 1 * mm, "https://recipes.bloodydaves.com")
    c.setFont(bold, 9)
    c.drawString(18 * mm, footer_y - 8 * mm, recipe_id)
    c.setFont(regular, 8)
    c.drawString(40 * mm, footer_y - 8 * mm, recipe.source_credit[:70])
    quote = recipe.bloody_dave_quote or "Cook it like you mean it."
    c.setFont(bold, 8)
    c.drawString(18 * mm, footer_y - 15 * mm, "BLOODY DAVE SAYS:")
    c.setFont(regular, 8)
    c.drawString(52 * mm, footer_y - 15 * mm, f'"{quote}"'[:90])

    # QR
    qr = qrcode.QRCode(version=2, box_size=8, border=1)
    qr.add_data(settings.qr_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    c.drawImage(ImageReader(qr_buf), width - 32 * mm, 12 * mm, width=20 * mm, height=20 * mm, mask="auto")

    if logo_path.exists():
        c.drawImage(str(logo_path), width - 55 * mm, 14 * mm, width=16 * mm, height=16 * mm, mask="auto", preserveAspectRatio=True)

    c.showPage()
    c.save()
    dest.write_bytes(buf.getvalue())
    if overflows:
        raise CardRenderError("Card layout overflow detected", overflows=overflows)
    return dest, overflows
