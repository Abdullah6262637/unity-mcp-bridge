import os
import re
import sys
import time
import subprocess
import threading

def kill_process(proc):
    if proc:
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

def main():
    print("[Desktop Boot] Starting Unity AI Desktop Workspace...")
    
    # 1. Compile Node.js MCP server
    print("[Desktop Boot] Verifying Node server compilation...")
    try:
        subprocess.run(["npm", "run", "build"], cwd="mcp-server", shell=True, check=True)
    except Exception as e:
        print(f"[Error] Failed to build MCP server: {e}")
        sys.exit(1)

    # 2. Launch the MCP Inspector (which handles starting the Node server internally)
    print("[Desktop Boot] Starting MCP Inspector proxy...")
    inspector_cmd = ["npx", "@modelcontextprotocol/inspector", "node", "dist/index.js"]
    
    # We use shell=True on Windows to support npx command execution
    inspector_proc = subprocess.Popen(
        inspector_cmd,
        cwd="mcp-server",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=True,
        bufsize=1
    )

    inspector_url = None
    url_pattern = re.compile(r"http://localhost:6274/\?MCP_PROXY_AUTH_TOKEN=\w+")

    # 3. Read inspector output in real-time to parse the auth token URL
    def monitor_inspector():
        nonlocal inspector_url
        while True:
            line = inspector_proc.stdout.readline()
            if not line:
                break
            print(f"[Inspector] {line.strip()}")
            match = url_pattern.search(line)
            if match and not inspector_url:
                inspector_url = match.group(0)
                print(f"[Desktop Boot] Parsed auth URL: {inspector_url}")

    monitor_thread = threading.Thread(target=monitor_inspector, daemon=True)
    monitor_thread.start()

    # Wait for the token URL to be parsed (up to 15 seconds)
    timeout = 15
    start_time = time.time()
    while not inspector_url and (time.time() - start_time) < timeout:
        if inspector_proc.poll() is not None:
            print("[Error] MCP Inspector crashed during startup.")
            sys.exit(1)
        time.sleep(0.5)

    if not inspector_url:
        print("[Warning] Could not parse inspector auth URL in time. Defaulting to standard URL.")
        inspector_url = "http://localhost:6274"

    # 4. Launch the Electron Desktop Application
    print("[Desktop Boot] Starting Electron UI...")
    env = os.environ.copy()
    env["MCP_INSPECTOR_URL"] = inspector_url

    # Check if node_modules exists in desktop-app, if not run npm install
    if not os.path.exists(os.path.join("desktop-app", "node_modules")):
        print("[Desktop Boot] Installing Electron dependencies (first-time setup)...")
        try:
            subprocess.run(["npm", "install"], cwd="desktop-app", shell=True, check=True)
        except Exception as e:
            print(f"[Error] Failed to install Electron dependencies: {e}")
            kill_process(inspector_proc)
            sys.exit(1)

    # Launch Electron
    electron_proc = subprocess.Popen(
        ["npm", "start"],
        cwd="desktop-app",
        env=env,
        shell=True
    )

    try:
        # Wait for Electron window to close
        electron_proc.wait()
        print("[Desktop Boot] Electron window closed by user.")
    except KeyboardInterrupt:
        print("[Desktop Boot] Keyboard interrupt received.")
    finally:
        # 5. Clean up and close all background servers
        print("[Desktop Boot] Shutting down background processes...")
        kill_process(electron_proc)
        kill_process(inspector_proc)
        print("[Desktop Boot] Shutdown complete. Goodbye!")

if __name__ == "__main__":
    main()
