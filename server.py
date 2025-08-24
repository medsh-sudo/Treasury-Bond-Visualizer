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
import requests

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
        # Handle TSETMC MarketWatchPlus data proxy
        if self.path.startswith('/api/tsetmc-data'):
            self.handle_tsetmc_data_proxy()
            return
        # Handle TSETMC HTML proxy
        if self.path.startswith('/api/tsetmc-html'):
            self.handle_tsetmc_html_proxy()
            return
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

    def handle_tsetmc_html_proxy(self):
        """Proxy for TSETMC HTML table page"""
        try:
            tsetmc_url = 'https://old.tsetmc.com/Loader.aspx?ParTree=15131F'
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fa,en-US;q=0.7,en;q=0.3',
                'Connection': 'keep-alive',
                'Referer': 'https://old.tsetmc.com/'
            }
            resp = requests.get(tsetmc_url, headers=headers, timeout=30)
            resp.raise_for_status()
            html = resp.content
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(html)
        except Exception as e:
            print(f"Error in TSETMC HTML proxy: {e}")
            self.send_error(500, f"Proxy error: {str(e)}")

    def handle_tsetmc_data_proxy(self):
        """Proxy for TSETMC MarketWatchPlus data"""
        try:
            tsetmc_data_url = 'https://old.tsetmc.com/tsev2/data/MarketWatchPlus.aspx?h=180000&r=14116121150'
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fa,en-US;q=0.7,en;q=0.3',
                'Connection': 'keep-alive',
                'Referer': 'https://old.tsetmc.com/',
                'Cache-Control': 'no-cache'
            }
            resp = requests.get(tsetmc_data_url, headers=headers, timeout=60)
            resp.raise_for_status()
            data = resp.content
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            print(f"Error in TSETMC data proxy: {e}")
            # Return sample data instead of error
            sample_data = """1,1000,538530,538870,19999,1,-,-,060615,40,167518,90315809060,538450,538900,538930,480,0.09,539140,690,0.13,538490,539870-03 اخزا301 اسناد خزانه-م1-س.قوا03-060615
1,25,784500,784870,4210,1,-,-,050325,34,104390,81954524040,782410,786100,784870,2460,0.31,785080,2670,0.34,783500,786150-02 اخزا201 اسنادخزانه-م1بودجه02-050325
1,5000000,810000,815390,1400000,2,-,-,070414,31,19315000,15744359000000,827510,815000,815000,-12510,-1.51,815140,-12370,-1.49,786140,868880-12370 اراد226 مرابحه عام دولت226-ش.خ070414"""
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(sample_data.encode('utf-8'))

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
        print(f"  - TSETMC HTML proxy: http://localhost:{PORT}/api/tsetmc-html")
        print(f"  - TSETMC Data proxy: http://localhost:{PORT}/api/tsetmc-data")
        print("\nTo use the API proxy in your JavaScript:")
        print("fetch('/api/proxy?url=' + encodeURIComponent('https://brsapi.ir/Api/Tsetmc/AllSymbols.php?key=BHiTdivFjl9mbgBec5euCt3apTaC43kn&type=4'))")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()

if __name__ == "__main__":
    main()
