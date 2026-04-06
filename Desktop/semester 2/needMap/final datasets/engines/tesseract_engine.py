import pytesseract
from PIL import Image
from .base import BaseOCREngine

# If on Windows, set path to tesseract executable
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

LANG_MAP = {
    "eng": "eng",
    "hin": "hin",
    "tel": "tel",
}

class TesseractEngine(BaseOCREngine):
    def load(self):
        pass  # No model loading needed for Tesseract

    def run(self, image_path: str, lang: str) -> str:
        try:
            tess_lang = LANG_MAP.get(lang, "eng")
            img = Image.open(image_path)
            return pytesseract.image_to_string(img, lang=tess_lang).strip()
        except Exception as e:
            return f"ERROR: {e}"