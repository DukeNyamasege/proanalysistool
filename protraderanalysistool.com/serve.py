import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = "."

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Check if the requested path corresponds to an actual file
        requested_path = self.translate_path(self.path)
        if not os.path.exists(requested_path) or os.path.isdir(requested_path):
            # If not, fallback to index.html for Single Page Application routing
            self.path = '/index.html'
        return super().do_GET()

# To allow address reuse if restarted quickly
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
    print(f"Serving Single Page App at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
