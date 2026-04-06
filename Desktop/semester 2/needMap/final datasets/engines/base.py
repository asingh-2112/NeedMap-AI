from abc import ABC, abstractmethod

class BaseOCREngine(ABC):
    """Every engine must implement these two methods."""

    @abstractmethod
    def load(self):
        """Load/initialize the model. Called once before benchmarking."""
        pass

    @abstractmethod
    def run(self, image_path: str, lang: str) -> str:
        """
        Run OCR on a single image.
        Returns extracted text as a plain string.
        """
        pass

    def __repr__(self):
        return f"<OCREngine: {self.__class__.__name__}>"