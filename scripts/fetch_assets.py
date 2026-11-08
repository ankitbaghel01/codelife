"""Download the free art assets into public/assets/ (run once: `python scripts/fetch_assets.py`).

Sources and licences (see public/assets/CREDITS.md, written by this script):
- Poly Haven models, textures and HDRI: CC0.
- Microsoft Rocketbox avatar and animations: MIT.
Needs Pillow (`pip install pillow`) to turn Rocketbox's 12 MB TGA textures into small JPG/PNG files.
"""

import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public" / "assets"
UA = {
    "User-Agent": "codelife-dev-asset-fetch"
}  # Poly Haven asks every client for a User-Agent

PH_MODELS = [
    "ClassicNightstand_01",
    "WoodenTable_01",
    "GreenChair_01",
    "classic_laptop",
    "desk_lamp_arm_01",
    "alarm_clock_01",
    "book_encyclopedia_set_01",
    "decorative_book_set_01",
    "anthurium_botany_01",
    "Shelf_01",
    "ceiling_fan",
    "electric_stove",
    "drawer_cabinet",
    # interview office (src/world/OfficeScene.tsx)
    "metal_office_desk",
    "modern_arm_chair_01",
    "modern_ceiling_lamp_01",
    "potted_plant_01",
]
PH_TEXTURES = [
    "wood_floor_worn",
    "painted_plaster_wall",
    "fabric_pattern_07",
    "white_plaster_02",
]
PH_HDRI = "hamburg_canal"

RB = "https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets"
HERO = "Male_Adult_07"
HERO_TEX = "m013"
ANIMS = {
    "idle": "Animations/all_animations_max_motextr_static/m_idle_neutral_01.max.fbx",
    "walk": "Animations/all_animations_max_motextr_xy/m_walk_neutral_01.max.fbx",
}

# Interviewer NPCs (src/world/OfficeScene.tsx): avatar folder -> texture prefix, plus seated idle animations.
NPCS = {"Male_Adult_04": "m006", "Female_Adult_11": "f011"}  # chosen to look South Asian
NPC_ANIMS = {
    "m_sit": "Animations/all_animations_max_motextr_static/m_sit_chair_idle_neutral_01.max.fbx",
    "f_sit": "Animations/all_animations_max_motextr_static/f_sit_chair_idle_neutral_01.max.fbx",
}


def get(url: str) -> bytes:
    with urllib.request.urlopen(
        urllib.request.Request(url.replace(" ", "%20"), headers=UA), timeout=120
    ) as r:
        return r.read()


def save(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"  {path.relative_to(ROOT)}  {len(data) // 1024} KB")


def ph_files(asset: str) -> dict:
    return json.loads(get(f"https://api.polyhaven.com/files/{asset}"))


def fetch_models() -> None:
    for m in PH_MODELS:
        out = ROOT / "models" / m
        if (out / f"{m}.gltf").exists():
            continue
        print(m)
        files = ph_files(m)
        if "gltf" not in files:
            print("  no glTF download for this model, skipped")
            continue
        g = files["gltf"]["1k"]["gltf"]
        save(out / f"{m}.gltf", get(g["url"]))
        for rel, f in g.get("include", {}).items():
            save(out / rel, get(f["url"]))


def fetch_textures() -> None:
    maps = {
        "Diffuse": "diff",
        "col_1": "diff",
        "nor_gl": "nor",
        "Rough": "rough",
        "arm": "arm",
    }
    for t in PH_TEXTURES:
        files = ph_files(t)
        for key, short in maps.items():
            if key in files and not (ROOT / "textures" / t / f"{short}.jpg").exists():
                save(
                    ROOT / "textures" / t / f"{short}.jpg",
                    get(files[key]["1k"]["jpg"]["url"]),
                )


def fetch_hdri() -> None:
    dest = ROOT / "hdri" / f"{PH_HDRI}_1k.hdr"
    if not dest.exists():
        save(dest, get(ph_files(PH_HDRI)["hdri"]["1k"]["hdr"]["url"]))


def fetch_avatar(name: str, tex: str, out: Path) -> None:
    base = f"{RB}/Avatars/Adults/{name}"
    if not (out / f"{name}.fbx").exists():
        save(out / f"{name}.fbx", get(f"{base}/Export/{name}.fbx"))
    for part in [
        "body_color",
        "body_normal",
        "head_color",
        "head_normal",
        "opacity_color",
    ]:
        # Opacity keeps its alpha channel (hair, eyelashes), so it stays PNG; the rest become JPG.
        ext = "png" if part == "opacity_color" else "jpg"
        dest = out / "textures" / f"{tex}_{part}.{ext}"
        if dest.exists():
            continue
        im = Image.open(io.BytesIO(get(f"{base}/Textures/{tex}_{part}.tga")))
        im = im.convert("RGBA" if ext == "png" else "RGB").resize(
            (1024, 1024), Image.LANCZOS
        )
        buf = io.BytesIO()
        im.save(buf, "PNG" if ext == "png" else "JPEG", quality=88, optimize=True)
        save(dest, buf.getvalue())


def fetch_hero() -> None:
    out = ROOT / "hero"
    fetch_avatar(HERO, HERO_TEX, out)
    for name, path in ANIMS.items():
        if not (out / f"anim_{name}.fbx").exists():
            save(out / f"anim_{name}.fbx", get(f"{RB}/{path}"))
    if not (out / "LICENSE.txt").exists():
        save(
            out / "LICENSE.txt",
            get(
                "https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/LICENSE.md"
            ),
        )


def fetch_npcs() -> None:
    out = ROOT / "npc"
    for name, tex in NPCS.items():
        fetch_avatar(name, tex, out)
    for name, path in NPC_ANIMS.items():
        if not (out / f"anim_{name}.fbx").exists():
            save(out / f"anim_{name}.fbx", get(f"{RB}/{path}"))
    if not (out / "LICENSE.txt").exists():
        save(out / "LICENSE.txt", (ROOT / "hero" / "LICENSE.txt").read_bytes())


def write_credits() -> None:
    (ROOT / "CREDITS.md").write_text(
        "# Asset credits\n\n"
        f"- Hero: Microsoft Rocketbox `{HERO}` and animations, MIT licence (see hero/LICENSE.txt). "
        "https://github.com/microsoft/Microsoft-Rocketbox\n"
        f"- Interviewers: Microsoft Rocketbox {', '.join(f'`{n}`' for n in NPCS)} and seated idle "
        "animations, MIT licence (see npc/LICENSE.txt).\n"
        "- Furniture, props, textures and HDRI: Poly Haven, CC0. https://polyhaven.com\n"
        f"  Models: {', '.join(PH_MODELS)}\n"
        f"  Textures: {', '.join(PH_TEXTURES)}; HDRI: {PH_HDRI}\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    steps = [
        fetch_hero,
        fetch_npcs,
        fetch_hdri,
        fetch_textures,
        fetch_models,
        write_credits,
    ]
    failed = []
    for step in steps:
        try:
            step()
        except Exception as e:  # keep going so one broken asset doesn't block the rest
            failed.append(f"{step.__name__}: {e}")
            print("FAILED", step.__name__, e, file=sys.stderr)
    print(
        "done" if not failed else f"{len(failed)} step(s) failed:\n" + "\n".join(failed)
    )
    sys.exit(1 if failed else 0)
