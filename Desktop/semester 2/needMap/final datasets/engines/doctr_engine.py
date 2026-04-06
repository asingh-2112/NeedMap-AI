from doctr.io import DocumentFile
from doctr.models import ocr_predictor
from .base import BaseOCREngine

class DoctrEngine(BaseOCREngine):
    def __init__(self):
        self.model = None

    def load(self):
        self.model = ocr_predictor(pretrained=True)

    def run(self, image_path: str, lang: str) -> str:
        try:
            if self.model is None:
                self.load()
            doc = DocumentFile.from_images(image_path)
            result = self.model(doc)
            lines = []
            for page in result.pages:
                for block in page.blocks:
                    for line in block.lines:
                        lines.append(" ".join(w.value for w in line.words))
            return " ".join(lines).strip()
        except Exception as e:
            return f"ERROR: {e}"