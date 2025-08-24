#!/usr/bin/env python3
"""
Simple HTTP Server for Treasury Bond Visualizer
This server helps avoid CORS issues when testing the application locally.
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse, parse_qs
import urllib.request
import json

PORT = 8000

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        # Handle API proxy for CORS
        if self.path.startswith('/api/proxy'):
            self.handle_api_proxy()
            return
        
        # Serve static files
        super().do_GET()
    
    def handle_api_proxy(self):
        """Proxy API requests to avoid CORS issues"""
        try:
            # Extract the target URL from the path
            query = urlparse(self.path).query
            params = parse_qs(query)
            
            if 'url' not in params:
                self.send_error(400, "Missing 'url' parameter")
                return
            
            target_url = params['url'][0]
            
            # Make the request to the target API
            req = urllib.request.Request(target_url)
            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            
            with urllib.request.urlopen(req) as response:
                data = response.read()
                
                # Set response headers
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                # Send the data
                self.wfile.write(data)
                
        except Exception as e:
            print(f"Error in API proxy: {e}")
            self.send_error(500, f"Proxy error: {str(e)}")

def main():
    # Change to the directory containing this script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Create the server
    with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server")
        print("\nAvailable endpoints:")
        print(f"  - Main app: http://localhost:{PORT}/index.html")
        print(f"  - API proxy: http://localhost:{PORT}/api/proxy?url=<target_url>")
        print("\nTo use the API proxy in your JavaScript:")
        print("fetch('/api/proxy?url=' + encodeURIComponent('https://brsapi.ir/Api/Tsetmc/AllSymbols.php?key=BHiTdivFjl9mbgBec5euCt3apTaC43kn&type=4'))")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()

if __name__ == "__main__":
    main()
