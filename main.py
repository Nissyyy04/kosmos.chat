import eel
import webview
import time
import socket
import sys
import os
import threading
import traceback
from functions import functionsList
from data import Config
import shared

config = Config("kosmos.chat", load_on_get=True)

class Application:
    class properties:
        title = 'kosmos.chat'
        width, height = 1000, 600
        web_folder = 'webfolder'
        index_file = 'index.html'
        resizable = True
        fullscreen = False
        frameless = True
        minimized = False
        host = '127.0.0.1'
        port = 8000

    def __init__(self) -> None:
        self.validate_structure()
        shared.app = self
        eel.init(self.properties.web_folder)
        for func in functionsList:
            eel.expose(func)

    def validate_structure(self):
        if not os.path.exists(self.properties.web_folder):
            raise FileNotFoundError(f"Web folder '{self.properties.web_folder}' not found!")
        index_path = os.path.join(self.properties.web_folder, self.properties.index_file)
        if not os.path.exists(index_path):
            raise FileNotFoundError(f"Index file '{index_path}' not found!")

    def is_port_available(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex((self.properties.host, self.properties.port)) != 0

    def start_eel_server(self):
        try:
            eel.start(
                self.properties.index_file,
                mode=None,
                host=self.properties.host,
                port=self.properties.port,
                block=True,
                shutdown_delay=5
            )
        except Exception as e:
            traceback.print_exc()
            print(f"🔥 Eel server failed to start: {str(e)}")
            sys.exit(1)

    def start(self):
        properties = self.properties
        if not self.is_port_available():
            print(f"⚠️ Port {properties.port} is already in use!")
            sys.exit(1)
        print("🚀 Starting Eel server on a separate thread (blocking mode)...")
        eel_thread = threading.Thread(target=self.start_eel_server, daemon=True)
        eel_thread.start()
        time.sleep(2)
        print("🪟 Creating application window...")
        try:
            webview.create_window(
                title=properties.title,
                url=f"http://{properties.host}:{properties.port}",
                width=properties.width,
                height=properties.height,
                resizable=properties.resizable,
                fullscreen=properties.fullscreen,
                frameless=properties.frameless,
                minimized=properties.minimized
            )
            webview.start()
        except Exception as e:
            print(f"💥 Window creation failed: {str(e)}")
            sys.exit(1)

if __name__ == '__main__':
    app = Application()
    app.start()
