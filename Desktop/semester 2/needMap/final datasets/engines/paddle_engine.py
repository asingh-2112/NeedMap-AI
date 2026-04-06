import os
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["CUDA_VISIBLE_DEVICES"] = ""

from paddleocr import PaddleOCR
from .base import BaseOCREngine

LANG_MAP = {
    "eng": "en",
    "hin": "hi",
    "tel": "te",
}

class PaddleEngine(BaseOCREngine):
    def __init__(self):
        self.models = {}

    def load(self):
        pass

    def run(self, image_path: str, lang: str) -> str:
        try:
            paddle_lang = LANG_MAP.get(lang, "en")
            if paddle_lang not in self.models:
                self.models[paddle_lang] = PaddleOCR(
                    lang=paddle_lang,
                    use_angle_cls=False,
                    show_log=False
                )
            result = self.models[paddle_lang].ocr(image_path)
            lines = []
            if result and result[0]:
                for item in result[0]:
                    if item and len(item) >= 2:
                        text = item[1][0] if isinstance(item[1], (list, tuple)) else item[1]
                        lines.append(str(text))
            return " ".join(lines).strip()
        except Exception as e:
            return f"ERROR: {e}"