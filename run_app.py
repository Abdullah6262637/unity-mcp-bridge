import os
import sys
import subprocess

def main():
    print("[Desktop Boot] Starting Unity AI Desktop Workspace...")
    
    # Check if node_modules exists in desktop-app, if not run npm install
    if not os.path.exists(os.path.join("desktop-app", "node_modules")):
        print("[Desktop Boot] Installing Electron dependencies (first-time setup)...")
        try:
            subprocess.run(["npm", "install"], cwd="desktop-app", shell=True, check=True)
        except Exception as e:
            print(f"[Error] Failed to install Electron dependencies: {e}")
            sys.exit(1)

    # Launch Electron
    print("[Desktop Boot] Starting Electron UI...")
    try:
        subprocess.run(["npm", "start"], cwd="desktop-app", shell=True, check=True)
    except KeyboardInterrupt:
        print("[Desktop Boot] Keyboard interrupt received.")
    except Exception as e:
        print(f"[Error] Electron failed to run: {e}")
        
    print("[Desktop Boot] Shutdown complete. Goodbye!")

if __name__ == "__main__":
    main()
