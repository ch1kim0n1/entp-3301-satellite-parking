from abc import ABC, abstractmethod
from typing import Any

import numpy as np
import torch
from PIL import Image
from transformers import RTDetrForObjectDetection, RTDetrImageProcessor

DEFAULT_MODEL = "PekingU/rtdetr_r50vd"
VEHICLE_LABELS = {"car", "truck", "bus", "motorcycle", "bicycle"}


class Detector(ABC):
    @abstractmethod
    def detect(self, image: np.ndarray) -> list[dict[str, Any]]:
        """Return detections as {bbox, confidence, label} with pixel-space bboxes."""
        ...


class StubDetector(Detector):
    def detect(self, image: np.ndarray) -> list[dict[str, Any]]:
        return []


class RTDetrDetector(Detector):
    def __init__(self, model_name: str = DEFAULT_MODEL, threshold: float = 0.3):
        self.model = RTDetrForObjectDetection.from_pretrained(model_name)
        self.processor = RTDetrImageProcessor.from_pretrained(model_name)
        self.threshold = threshold
        self.model.eval()

    def detect(self, image: np.ndarray) -> list[dict[str, Any]]:
        if image.ndim == 2:
            image = np.stack([image] * 3, axis=-1)
        if image.shape[-1] == 4:
            image = image[..., :3]

        pil = Image.fromarray(image.astype(np.uint8))
        inputs = self.processor(images=pil, return_tensors="pt")
        with torch.no_grad():
            outputs = self.model(**inputs)

        results = self.processor.post_process_object_detection(
            outputs,
            target_sizes=torch.tensor([[pil.height, pil.width]]),
            threshold=self.threshold,
        )[0]

        detections = []
        for score, label_id, bbox in zip(results["scores"], results["labels"], results["boxes"]):
            label = self.model.config.id2label[label_id.item()]
            if label not in VEHICLE_LABELS:
                continue
            xmin, ymin, xmax, ymax = bbox.tolist()
            detections.append(
                {
                    "bbox": (xmin, ymin, xmax, ymax),
                    "confidence": float(score),
                    "label": label,
                }
            )
        return detections
