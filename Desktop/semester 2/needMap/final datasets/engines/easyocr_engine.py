import easyocr
from .base import BaseOCREngine

LANG_MAP = {
    "eng": ["en"],
    "hin": ["hi"],
    "tel": ["te"],  # note: EasyOCR has limited Telugu support
}

class EasyOCREngine(BaseOCREngine):
    def __init__(self):
        self.readers = {}  # cache one reader per language combo

    def load(self):
        pass  # readers are lazy-loaded per language in run()

    def run(self, image_path: str, lang: str) -> str:
        try:
            langs = tuple(LANG_MAP.get(lang, ["en"]))
            if langs not in self.readers:
                self.readers[langs] = easyocr.Reader(list(langs), gpu=False)
            result = self.readers[langs].readtext(image_path, detail=0)
            return " ".join(result).strip()
        except Exception as e:
            return f"ERROR: {e}"