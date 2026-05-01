from __future__ import annotations

import logging
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

try:
    import pytesseract
except ImportError:  # pragma: no cover - depends on optional runtime package
    pytesseract = None

try:
    from PIL import Image, UnidentifiedImageError
except ImportError:  # pragma: no cover - depends on optional runtime package
    Image = None
    UnidentifiedImageError = ValueError

try:
    from PyPDF2 import PdfReader
except ImportError:  # pragma: no cover - depends on optional runtime package
    PdfReader = None


logger = logging.getLogger(__name__)


@dataclass
class OCRResult:
    text: str
    extraction_method: str


class OCRService:
    IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
    PDF_EXTENSIONS = {".pdf"}

    def detect_file_type(self, file_bytes: bytes, filename: str, content_type: str | None) -> str:
        content_type_value = (content_type or "").lower()
        suffix = Path(filename or "uploaded_file").suffix.lower()

        if "pdf" in content_type_value or suffix in self.PDF_EXTENSIONS or file_bytes.startswith(b"%PDF"):
            return "pdf"

        if content_type_value.startswith("image/") or suffix in self.IMAGE_EXTENSIONS:
            return "image"

        if Image is not None:
            try:
                with Image.open(BytesIO(file_bytes)) as image:
                    image.verify()
                return "image"
            except Exception:  # pylint: disable=broad-except
                pass

        raise ValueError("Unsupported file format. Use PDF, PNG, JPG, or JPEG.")

    def extract_text_from_image(self, file_bytes: bytes) -> OCRResult:
        logger.info("OCR image extraction started")
        if Image is None or pytesseract is None:
            fallback_text = self._decode_text_fallback(file_bytes)
            if fallback_text:
                return OCRResult(text=fallback_text, extraction_method="binary_text_fallback")
            raise RuntimeError("Image OCR dependencies are not installed")

        try:
            with Image.open(BytesIO(file_bytes)) as image:
                rgb_image = image.convert("RGB")
                text = pytesseract.image_to_string(rgb_image).strip()
        except UnidentifiedImageError as exc:
            raise ValueError("Uploaded file is not a valid image") from exc
        except pytesseract.TesseractNotFoundError as exc:
            raise RuntimeError(
                "Tesseract OCR binary is not available in runtime. Install tesseract-ocr."
            ) from exc
        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("Image OCR failed")
            fallback_text = self._decode_text_fallback(file_bytes)
            if fallback_text:
                logger.warning("Image OCR fallback to byte decode succeeded")
                return OCRResult(text=fallback_text, extraction_method="binary_text_fallback")
            raise RuntimeError("Image OCR failed") from exc

        if text:
            logger.info("OCR image extraction finished with text")
            return OCRResult(text=text, extraction_method="image_ocr")

        fallback_text = self._decode_text_fallback(file_bytes)
        if fallback_text:
            logger.warning("Image OCR returned empty text. Using byte decode fallback")
            return OCRResult(text=fallback_text, extraction_method="binary_text_fallback")

        raise RuntimeError("No text could be extracted from image")

    def extract_text_from_pdf(self, file_bytes: bytes) -> OCRResult:
        logger.info("PDF extraction started")
        if PdfReader is None:
            fallback_text = self._decode_text_fallback(file_bytes)
            if fallback_text:
                return OCRResult(text=fallback_text, extraction_method="binary_text_fallback")
            raise RuntimeError("PDF extraction dependency PyPDF2 is not installed")

        try:
            reader = PdfReader(BytesIO(file_bytes))
        except Exception as exc:  # pylint: disable=broad-except
            raise ValueError("Uploaded file is not a valid PDF") from exc

        direct_text_segments: list[str] = []
        for page in reader.pages:
            page_text = (page.extract_text() or "").strip()
            if page_text:
                direct_text_segments.append(page_text)

        direct_text = "\n".join(direct_text_segments).strip()
        if len(direct_text) >= 30:
            logger.info("PDF direct text extraction succeeded")
            return OCRResult(text=direct_text, extraction_method="pdf_text")

        logger.warning("PDF appears scanned/empty. Falling back to image OCR")
        ocr_text = self._extract_text_from_pdf_images(reader)
        if ocr_text:
            logger.info("PDF OCR fallback succeeded")
            return OCRResult(text=ocr_text, extraction_method="pdf_ocr")

        if direct_text:
            logger.warning("Returning sparse direct PDF text after OCR fallback failed")
            return OCRResult(text=direct_text, extraction_method="pdf_text")

        fallback_text = self._decode_text_fallback(file_bytes)
        if fallback_text:
            logger.warning("Using PDF byte decode fallback")
            return OCRResult(text=fallback_text, extraction_method="binary_text_fallback")

        raise RuntimeError("No text could be extracted from PDF")

    def _extract_text_from_pdf_images(self, reader: PdfReader) -> str:
        if Image is None or pytesseract is None:
            return ""

        extracted_segments: list[str] = []
        for page_index, page in enumerate(reader.pages, start=1):
            page_images = getattr(page, "images", [])
            if not page_images:
                continue

            for image_index, page_image in enumerate(page_images, start=1):
                try:
                    with Image.open(BytesIO(page_image.data)) as image:
                        text = pytesseract.image_to_string(image.convert("RGB")).strip()
                    if text:
                        extracted_segments.append(text)
                except pytesseract.TesseractNotFoundError as exc:
                    raise RuntimeError(
                        "Tesseract OCR binary is not available in runtime. Install tesseract-ocr."
                    ) from exc
                except Exception:  # pylint: disable=broad-except
                    logger.warning(
                        "Skipping non-readable embedded PDF image page=%s image=%s",
                        page_index,
                        image_index,
                    )

        return "\n".join(extracted_segments).strip()

    def _decode_text_fallback(self, file_bytes: bytes) -> str:
        decoded = file_bytes.decode("utf-8", errors="ignore")
        if not decoded:
            return ""

        printable = "".join(char if char.isprintable() else " " for char in decoded)
        compact = " ".join(printable.split())
        return compact if len(compact) >= 40 else ""
