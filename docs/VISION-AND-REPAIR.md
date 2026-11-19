# FORGE Vision and Repair

## Available now
- Image metadata and dimensions through optional Pillow support.
- Screenshot-to-screenshot RGB difference image.
- Mean absolute pixel error and a simple normalized similarity proxy.
- A bounded repair-loop primitive that requires caller-supplied check and repair callbacks.

Install vision support with `uv sync --extra vision` or `pip install -e '.[vision]'`.

## Current limitations
This is not yet semantic image understanding or image-to-UI extraction. The pixel score is sensitive to font rendering, viewport size, and small shifts; it is not SSIM and must not be presented as a perceptual score. The repair loop does not invent or apply code fixes by itself; a trusted caller must supply the repair callback.

## Next
Add a multimodal model adapter for reference-image analysis, browser screenshot capture, region-aware visual checks, OCR, perceptual metrics, and a gated repair agent that reruns tests after each proposed patch.
