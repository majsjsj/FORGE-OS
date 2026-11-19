"""Image metadata and screenshot comparison using optional Pillow."""
from pathlib import Path

from forge_os.core.safety import safe_path


def image_info(root: str, relative_path: str) -> dict:
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Install FORGE vision extras: pip install 'forge-os[vision]'") from exc
    path=safe_path(root, relative_path)
    with Image.open(path) as im:
        return {"path": relative_path, "format": im.format, "width": im.width, "height": im.height,
                "mode": im.mode, "bytes": path.stat().st_size}


def compare_images(root: str, reference: str, rendered: str, output: str = "forge-diff.png") -> dict:
    try:
        from PIL import Image, ImageChops, ImageStat
    except ImportError as exc:
        raise RuntimeError("Install FORGE vision extras: pip install 'forge-os[vision]'") from exc
    ref_path=safe_path(root, reference); out_path=safe_path(root, rendered)
    with Image.open(ref_path) as a, Image.open(out_path) as b:
        a=a.convert("RGB"); b=b.convert("RGB")
        same_size=a.size == b.size
        if not same_size: b=b.resize(a.size)
        diff=ImageChops.difference(a,b)
        mean=sum(ImageStat.Stat(diff).mean)/3
        normalized=max(0.0, min(1.0, 1.0-mean/255.0))
        target=safe_path(root, output, for_write=True)
        target.parent.mkdir(parents=True, exist_ok=True)
        diff.save(target, format="PNG")
        return {"reference": reference, "rendered": rendered, "same_dimensions": same_size,
                "reference_dimensions": list(a.size), "rendered_dimensions": list(Image.open(out_path).size),
                "mean_absolute_pixel_error": round(mean, 4), "similarity_proxy": round(normalized, 4),
                "diff_image": str(target.relative_to(Path(root).resolve())),
                "note": "Similarity proxy is a simple RGB pixel metric, not SSIM or proof of perceptual equivalence."}
