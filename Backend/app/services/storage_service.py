import os
import shutil
import base64
from datetime import datetime
from typing import List
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class StorageService:
    """Service for managing file storage"""
    
    def __init__(self):
        self.base_path = settings.STORAGE_BASE_PATH
        self.images_path = settings.IMAGES_PATH
        self.scripts_path = settings.SCRIPTS_PATH
        self.screenshots_path = os.path.join(self.base_path, "screenshots")
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Ensure storage directories exist"""
        os.makedirs(self.images_path, exist_ok=True)
        os.makedirs(self.scripts_path, exist_ok=True)
        os.makedirs(self.screenshots_path, exist_ok=True)
    
    def create_execution_directory(self, execution_id: str) -> tuple[str, str]:
        """Create directories for a specific execution"""
        execution_images_path = os.path.join(self.images_path, execution_id)
        execution_scripts_path = os.path.join(self.scripts_path, execution_id)
        
        os.makedirs(execution_images_path, exist_ok=True)
        os.makedirs(execution_scripts_path, exist_ok=True)
        
        return execution_images_path, execution_scripts_path
    
    def copy_images(self, source_paths: List[str], execution_id: str) -> List[str]:
        """
        Handle both base64 encoded images and file paths.
        If input is base64, decode and save. If input is file path, copy.
        """
        logger.info(f"[{execution_id}] Processing {len(source_paths)} images")
        execution_images_path, _ = self.create_execution_directory(execution_id)
        copied_paths = []
        
        for idx, source in enumerate(source_paths):
            try:
                dest_filename = f"image_{idx + 1}"
                dest_path = os.path.join(execution_images_path, dest_filename)
                
                # Check if input is base64 encoded (starts with data:image/ or is raw base64)
                if isinstance(source, str) and (source.startswith('data:image/') or self._is_base64(source)):
                    # Handle base64 encoded image
                    dest_path = self._save_base64_image(source, dest_path, execution_id)
                    if dest_path:
                        copied_paths.append(dest_path)
                        logger.debug(f"[{execution_id}] Decoded and saved base64 image: {dest_path}")
                elif os.path.exists(source):
                    # Handle file path
                    ext = os.path.splitext(source)[1]
                    dest_path = os.path.join(execution_images_path, f"{dest_filename}{ext}")
                    shutil.copy2(source, dest_path)
                    copied_paths.append(dest_path)
                    logger.debug(f"[{execution_id}] Copied: {source} -> {dest_path}")
                else:
                    logger.warning(f"[{execution_id}] Invalid image source: {source}")
            except Exception as e:
                logger.error(f"[{execution_id}] Error processing image {idx + 1}: {str(e)}")
                continue
        
        logger.info(f"[{execution_id}] Successfully processed {len(copied_paths)} images")
        return copied_paths
    
    def _save_base64_image(self, base64_data: str, dest_path: str, execution_id: str) -> str:
        """
        Decode base64 image data and save to file.
        Returns the path to saved image, or None if failed.
        """
        try:
            # Remove data:image/ prefix if present
            if base64_data.startswith('data:image/'):
                # Extract mime type and base64 data
                parts = base64_data.split(',')
                if len(parts) != 2:
                    logger.error(f"[{execution_id}] Invalid base64 format")
                    return None
                
                mime_type = parts[0].split(';')[0].replace('data:', '')
                base64_string = parts[1]
                
                # Determine file extension from mime type
                ext = self._get_extension_from_mime(mime_type)
            else:
                # Assume raw base64, try to detect format
                base64_string = base64_data
                ext = '.png'  # Default to PNG
            
            # Decode base64 string
            image_data = base64.b64decode(base64_string)
            
            # Save to file
            final_dest_path = dest_path + ext
            with open(final_dest_path, 'wb') as f:
                f.write(image_data)
            
            logger.debug(f"[{execution_id}] Base64 image decoded and saved: {final_dest_path}")
            return final_dest_path
        except Exception as e:
            logger.error(f"[{execution_id}] Error decoding base64 image: {str(e)}")
            return None
    
    def _is_base64(self, string: str) -> bool:
        """Check if string is valid base64 encoded."""
        try:
            if isinstance(string, str):
                # Remove whitespace
                string = string.strip()
                # Base64 should be able to decode
                base64.b64decode(string, validate=True)
                return True
            return False
        except Exception:
            return False
    
    def _get_extension_from_mime(self, mime_type: str) -> str:
        """Get file extension from mime type."""
        mime_map = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/bmp': '.bmp',
            'image/webp': '.webp',
            'image/x-icon': '.ico',
        }
        return mime_map.get(mime_type, '.png')
    
    def save_script(
        self,
        script_content: str,
        execution_id: str,
        scenario_id: str
    ) -> str:
        """Save generated script to file"""
        logger.info(f"[{execution_id}] Saving script for scenario: {scenario_id}")
        _, execution_scripts_path = self.create_execution_directory(execution_id)
        
        script_filename = f"{scenario_id}.py"
        script_path = os.path.join(execution_scripts_path, script_filename)
        
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(script_content)
        
        logger.debug(f"[{execution_id}] Script saved: {script_path}")
        return script_path
    
    def get_script_path(self, execution_id: str, scenario_id: str) -> str:
        """Get path to a specific script"""
        return os.path.join(self.scripts_path, execution_id, f"{scenario_id}.py")

    def prepare_scenario_screenshots(self, execution_id: str, scenario_id: str) -> str:
        """Create a clean screenshot folder for one scenario execution."""
        screenshot_dir = os.path.join(self.screenshots_path, execution_id, scenario_id)
        os.makedirs(screenshot_dir, exist_ok=True)
        for filename in os.listdir(screenshot_dir):
            if filename.lower().endswith(".png"):
                os.remove(os.path.join(screenshot_dir, filename))
        return screenshot_dir

    def get_scenario_screenshots_path(self, execution_id: str, scenario_id: str) -> str:
        return os.path.join(self.screenshots_path, execution_id, scenario_id)
    
    def get_execution_images(self, execution_id: str) -> List[str]:
        """Get all images for an execution"""
        execution_images_path = os.path.join(self.images_path, execution_id)
        
        if not os.path.exists(execution_images_path):
            return []
        
        images = []
        for filename in os.listdir(execution_images_path):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                images.append(os.path.join(execution_images_path, filename))
        
        return sorted(images)
    
    def get_execution_scripts(self, execution_id: str) -> List[str]:
        """Get all scripts for an execution"""
        execution_scripts_path = os.path.join(self.scripts_path, execution_id)
        
        if not os.path.exists(execution_scripts_path):
            return []
        
        scripts = []
        for filename in os.listdir(execution_scripts_path):
            if filename.endswith('.py'):
                scripts.append(os.path.join(execution_scripts_path, filename))
        
        return sorted(scripts)
