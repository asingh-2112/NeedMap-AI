import os
import random

def sample_images(folder_path, max_images=20):
    images = [f for f in os.listdir(folder_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]  
    if len(images) > max_images:
        images = random.sample(images, max_images)
    return [os.path.join(folder_path, img) for img in images]