import json
from pathlib import Path
import os
import traceback
import logging

class Config:
    def __init__(self, folder_name: str = "MyConfig", file_name: str = "config.json", load_on_get: bool = False):
        """
        Initialize the configuration.
        
        :param folder_name: The name of the folder inside the user's Documents directory.
        :param file_name: The name of the configuration file.
        """
        try:
            # Determine the user's Documents folder (works on most platforms)
            self.documents_path = Path.home() / "Documents"
            self.config_folder = self.documents_path / folder_name
            self.config_folder.mkdir(parents=True, exist_ok=True)  # Create folder if it doesn't exist
            self.config_file = self.config_folder / file_name
            self.load_on_get = load_on_get

            # Load existing config or initialize empty config
            if self.config_file.exists():
                self.load()
            else:
                self.data = {}
                self.save()
        except Exception as e:
            print(f"Error initializing config: {str(e)}")
            traceback.print_exc()
            # Fallback to local directory if Documents folder is not accessible
            self.config_folder = Path.cwd() / "data"
            self.config_folder.mkdir(parents=True, exist_ok=True)
            self.config_file = self.config_folder / file_name
            self.data = {}
            self.save()

    def save(self):
        """Save the current configuration to the JSON file."""
        try:
            with self.config_file.open("w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=4)
        except Exception as e:
            print(f"Error saving config: {str(e)}")
            traceback.print_exc()
    
    def load(self):
        """Load the configuration from the JSON file."""
        try:
            if self.config_file.exists():
                with self.config_file.open("r", encoding="utf-8") as f:
                    self.data = json.load(f)
            else:
                self.data = {}
        except Exception as e:
            print(f"Error loading config: {str(e)}")
            traceback.print_exc()
            self.data = {}
            self.save()

    def get(self, key, default=None):
        """
        Retrieve a value from the configuration.
        
        :param key: The key to look up.
        :param default: A default value if the key is not found.
        :return: The value associated with the key, or the default.
        """
        try:
            if self.load_on_get:
                self.load()
            return self.data.get(key, default)
        except Exception as e:
            logging.error(f"Error getting config value for {key}: {e}", exc_info=True)
            return default


    def set(self, key, value):
        """
        Set a configuration value.
        
        :param key: The key to set.
        :param value: The value to assign to the key.
        """
        try:
            self.data[key] = value
            self.save()
        except Exception as e:
            print(f"Error setting config value: {str(e)}")
            traceback.print_exc()

    def delete(self, key):
        """
        Delete a configuration value.
        
        :param key: The key to remove.
        """
        try:
            if key in self.data:
                del self.data[key]
                self.save()
        except Exception as e:
            print(f"Error deleting config value: {str(e)}")
            traceback.print_exc()

    def reset(self):
        """Reset the configuration to an empty state."""
        try:
            self.data = {}
            self.save()
        except Exception as e:
            print(f"Error resetting config: {str(e)}")
            traceback.print_exc()
