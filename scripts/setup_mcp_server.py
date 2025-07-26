#!/usr/bin/env python3
import os
import time
from pathlib import Path

import paramiko
import requests


def load_env_file() -> None:
    """Load environment variables from .env file automatically."""
    # Get the script's directory and go up one level to find .env
    script_dir = Path(__file__).resolve().parent
    env_file = script_dir.parent / ".env"

    print(f"🔍 Looking for .env file at: {env_file}")
    if env_file.exists():
        print(f"✅ Found .env file: {env_file}")
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                if line.strip() and not line.startswith("#") and "=" in line:
                    key, value = line.strip().split("=", 1)
                    value = value.strip("\"'")
                    os.environ[key] = value
                    print(f"🔧 Loaded env var: {key}")
    else:
        print(f"⚠️  .env file not found at: {env_file}")
        print(f"📍 Script location: {script_dir}")
        print(f"📁 Parent directory: {script_dir.parent}")
        print("📂 Contents of parent directory:")
        try:
            for item in script_dir.parent.iterdir():
                print(f"   - {item.name}")
        except Exception as e:
            print(f"   Error listing directory: {e}")


# Load environment variables first
load_env_file()

# --- CONFIGURATION ---
DO_API_TOKEN = os.environ.get("DO_API_TOKEN")
SSH_KEY_NAME = os.environ.get("SSH_KEY_NAME", "mcp-key")
SSH_PRIVATE_KEY_PATH = os.environ.get("SSH_PRIVATE_KEY_PATH", "~/.ssh/id_rsa")
SSH_PUBLIC_KEY_PATH = os.environ.get("SSH_PUBLIC_KEY_PATH", "~/.ssh/id_rsa.pub")
DROPLET_NAME = "mcp-memory-server"
DROPLET_REGION = "nyc3"
DROPLET_SIZE = "s-1vcpu-1gb"
DROPLET_IMAGE = "ubuntu-22-04-x64"  # Back to standard Ubuntu
DOCKER_IMAGE = "mcp/memory:latest"  # Official MCP memory server image
DOCKER_PORT = 3000
HTTP_WRAPPER_PORT = 8080  # HTTP wrapper port for external access


# --- HELPERS ---
def get_headers():
    return {
        "Authorization": f"Bearer {DO_API_TOKEN}",
        "Content-Type": "application/json",
    }


def read_public_key():
    with open(os.path.expanduser(SSH_PUBLIC_KEY_PATH), "r") as f:
        return f.read().strip()


def get_ssh_key_id():
    print(f"🔍 Looking for SSH key named: '{SSH_KEY_NAME}'")

    resp = requests.get(
        "https://api.digitalocean.com/v2/account/keys", headers=get_headers()
    )
    resp.raise_for_status()
    keys = resp.json()["ssh_keys"]

    for key in keys:
        if key["name"] == SSH_KEY_NAME:
            print(f"✅ Found existing key '{SSH_KEY_NAME}' (ID: {key['id']})")
            return key["id"]

    # Add key if not present
    print(f"🔑 Adding new SSH key '{SSH_KEY_NAME}'...")
    try:
        pubkey = read_public_key()
        print(f"📝 Public key length: {len(pubkey)} characters")
        print(f"🔍 Public key preview: {pubkey[:50]}...")

        resp = requests.post(
            "https://api.digitalocean.com/v2/account/keys",
            headers=get_headers(),
            json={"name": SSH_KEY_NAME, "public_key": pubkey},
        )

        if resp.status_code != 201:
            print(f"❌ API Error {resp.status_code}: {resp.text}")

        resp.raise_for_status()
        new_key = resp.json()["ssh_key"]
        print(f"✅ Successfully added SSH key '{SSH_KEY_NAME}' (ID: {new_key['id']})")
        return new_key["id"]
    except FileNotFoundError:
        raise Exception(f"❌ SSH public key file not found: {SSH_PUBLIC_KEY_PATH}")
    except Exception as e:
        print(f"❌ Error details: {e}")
        raise


def get_docker_user_data():
    """Generate cloud-init user data to install Docker during droplet creation."""
    return """#cloud-config
package_update: true
package_upgrade: true

packages:
  - docker.io
  - docker-compose
  - curl

runcmd:
  - systemctl start docker
  - systemctl enable docker
  - usermod -aG docker root
  - docker --version

final_message: "Docker installation completed successfully"
"""


def create_droplet(ssh_key_id: int):
    print(f"🚀 Creating droplet '{DROPLET_NAME}' with Docker pre-installation...")
    data = {
        "name": DROPLET_NAME,
        "region": DROPLET_REGION,
        "size": DROPLET_SIZE,
        "image": DROPLET_IMAGE,
        "ssh_keys": [ssh_key_id],
        "backups": False,
        "ipv6": False,
        "user_data": get_docker_user_data(),  # Install Docker during creation
        "private_networking": None,
        "volumes": None,
        "tags": ["mcp", "docker-preinstalled"],
    }
    resp = requests.post(
        "https://api.digitalocean.com/v2/droplets", headers=get_headers(), json=data
    )
    resp.raise_for_status()
    droplet = resp.json()["droplet"]
    print(f"📦 Droplet {droplet['id']} initiated...")
    return droplet["id"]


def wait_for_droplet(droplet_id: int):
    print("⏳ Waiting for droplet to become active...")
    while True:
        resp = requests.get(
            f"https://api.digitalocean.com/v2/droplets/{droplet_id}",
            headers=get_headers(),
        )
        resp.raise_for_status()
        droplet = resp.json()["droplet"]
        if droplet["status"] == "active":
            ip = droplet["networks"]["v4"][0]["ip_address"]
            print(f"✅ Droplet ready at {ip}")
            print("⏳ Giving cloud-init a head start...")
            time.sleep(
                30
            )  # Reduced wait, we'll check Docker availability in SSH commands
            return ip
        print("⏳ Still waiting for droplet to be active...")
        time.sleep(10)


def ssh_run(ip: str, commands: list[str]):  # noqa: C901
    """SSH into the droplet and run commands with proper error handling."""

    # Get SSH key passphrase
    passphrase = os.environ.get("SSH_KEY_PASSPHRASE")
    if not passphrase:
        passphrase = input("Enter SSH key passphrase: ")

    # Load SSH key
    try:
        key = paramiko.RSAKey.from_private_key_file(
            os.path.expanduser(SSH_PRIVATE_KEY_PATH), password=passphrase
        )
        print("🔑 SSH key loaded successfully")
    except paramiko.SSHException as e:
        raise Exception(f"❌ Failed to load SSH key: {e}")

    # Connect with retries
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    print(f"🔌 Connecting to {ip}...")
    connected = False

    # Wait for SSH to be available (can take 2-3 minutes after droplet is "active")
    for attempt in range(30):  # 5 minutes total
        try:
            ssh.connect(ip, username="root", pkey=key, timeout=10, banner_timeout=30)
            connected = True
            print(f"✅ SSH connection established on attempt {attempt + 1}")
            break

        except (
            paramiko.AuthenticationException,
            paramiko.SSHException,
            OSError,
            Exception,
        ) as e:
            print(
                f"⏳ Attempt {attempt + 1}/30: SSH not ready yet ({type(e).__name__})"
            )
            if attempt < 29:  # Don't sleep on the last attempt
                time.sleep(10)

    if not connected:
        raise Exception(f"❌ Failed to connect to {ip} after 30 attempts (5 minutes)")

    # Execute commands
    try:
        for i, cmd in enumerate(commands, 1):
            print(f"🚀 Running command {i}/{len(commands)}: {cmd}")
            _, stdout, stderr = ssh.exec_command(
                cmd, timeout=300
            )  # 5 minute timeout per command

            # Read output
            output = stdout.read().decode().strip()
            error = stderr.read().decode().strip()
            exit_status = stdout.channel.recv_exit_status()

            if output:
                print(f"📤 Output: {output}")
            if error:
                print(f"⚠️  Error: {error}")
            if exit_status != 0:
                print(f"❌ Command failed with exit status: {exit_status}")
                raise Exception(f"Command failed: {cmd} (exit status: {exit_status})")
            else:
                print("✅ Command completed successfully")

    except Exception as e:
        print(f"❌ Error executing commands: {e}")
        raise
    finally:
        ssh.close()
        print("🔐 SSH connection closed")


# --- MAIN ---
def main():
    if not DO_API_TOKEN:
        raise Exception(
            "❌ Set your DigitalOcean API token in DO_API_TOKEN env variable."
        )

    print("🚀 Starting MCP server setup...")

    try:
        # Step 1: Get or create SSH key
        ssh_key_id = get_ssh_key_id()

        # Step 2: Create droplet
        droplet_id = create_droplet(ssh_key_id)

        # Step 3: Wait for droplet to be ready
        ip = wait_for_droplet(droplet_id)

        # Step 4: Deploy HTTP-accessible MCP server (Containerized approach)
        install_commands = [
            # Check cloud-init status first
            "echo 'Checking cloud-init status...'",
            "cloud-init status --long || echo 'Cloud-init status not available'",
            # Wait for cloud-init to complete Docker installation
            "echo 'Waiting for cloud-init to complete Docker installation...'",
            "echo 'This can take 5-10 minutes on a fresh Ubuntu droplet'",
            "timeout_counter=0",
            "while ! command -v docker &> /dev/null; do echo \"Docker not ready, waiting 30s... (${timeout_counter}m elapsed)\"; sleep 30; timeout_counter=$((timeout_counter + 1)); if [ $timeout_counter -gt 20 ]; then echo 'Timeout waiting for Docker installation'; exit 1; fi; done",
            "echo 'Docker command available, waiting for service to be active...'",
            "while ! systemctl is-active --quiet docker; do echo 'Docker service not active, waiting 10s...'; sleep 10; done",
            "echo 'Docker is ready!'",
            # Verify Docker installation
            "docker --version",
            "systemctl status docker --no-pager -l",
            # Create Dockerfile for HTTP-enabled MCP server
            "cat > /root/Dockerfile << 'DOCKERFILE_EOF'",
        ]

        # Read both the Dockerfile and HTTP wrapper script content
        script_dir = Path(__file__).resolve().parent
        dockerfile_path = script_dir / "Dockerfile.mcp-http"
        wrapper_script = script_dir / "http_mcp_wrapper.py"
        
        if not dockerfile_path.exists():
            raise Exception(f"Dockerfile not found: {dockerfile_path}")
        if not wrapper_script.exists():
            raise Exception(f"HTTP wrapper script not found: {wrapper_script}")
        
        # Add Dockerfile content
        with open(dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        install_commands.append(dockerfile_content)
        
        install_commands.extend([
            "DOCKERFILE_EOF",
            # Create the HTTP wrapper script
            "cat > /root/http_mcp_wrapper.py << 'WRAPPER_EOF'",
        ])
        
        # Add HTTP wrapper content
        with open(wrapper_script, 'r') as f:
            wrapper_content = f.read()
        install_commands.append(wrapper_content)
        
        install_commands.extend([
            "WRAPPER_EOF",
            # Build the custom HTTP-enabled MCP server image
            "echo 'Building HTTP-enabled MCP server image...'",
            "docker build -t mcp-http-server:latest -f /root/Dockerfile /root/",
            # Run the containerized HTTP server as non-root
            f"echo 'Starting HTTP MCP server container on port {HTTP_WRAPPER_PORT}...'",
            f"docker run -d --name mcp-http-server --restart unless-stopped -p {HTTP_WRAPPER_PORT}:8080 mcp-http-server:latest",
            "sleep 10",
            # Verify the service is running
            f"if curl -f http://localhost:{HTTP_WRAPPER_PORT}/health; then echo 'HTTP MCP server is running!'; else echo 'HTTP MCP server failed to start'; docker logs mcp-http-server; exit 1; fi",
            # Show running containers
            "docker ps",
            "echo 'Setup completed successfully!'",
        ])

        # Step 5: Execute installation
        ssh_run(ip, install_commands)

        print(
            f"\n🎉 HTTP-accessible MCP Memory server is now running!"
        )
        print(f"🌐 Base URL: http://{ip}:{HTTP_WRAPPER_PORT}")
        print(f"🔗 Health check: http://{ip}:{HTTP_WRAPPER_PORT}/health")
        print(f"� API documentation: http://{ip}:{HTTP_WRAPPER_PORT}/docs")
        print(f"🧠 MCP endpoint: http://{ip}:{HTTP_WRAPPER_PORT}/mcp")
        print("\n📋 Available memory endpoints:")
        print(f"   • Create entities: POST http://{ip}:{HTTP_WRAPPER_PORT}/memory/entities")
        print(f"   • Create relations: POST http://{ip}:{HTTP_WRAPPER_PORT}/memory/relations")
        print(f"   • Add observations: POST http://{ip}:{HTTP_WRAPPER_PORT}/memory/observations")
        print(f"   • Search memory: GET http://{ip}:{HTTP_WRAPPER_PORT}/memory/search?q=your-query")
        print(f"   • Read full graph: GET http://{ip}:{HTTP_WRAPPER_PORT}/memory/graph")
        print(f"   • Open specific nodes: GET http://{ip}:{HTTP_WRAPPER_PORT}/memory/nodes?names=node1,node2")
        print("\n🔍 Check logs: ssh root@{} 'docker logs mcp-http-server'".format(ip))
        print("🔒 Security: Running as non-root user 'mcpuser' inside container")
        print("🚀 Your MCP server is now accessible from GitHub Copilot and other remote clients!")
        print("\n💡 Example usage:")
        print(f"   curl -X GET http://{ip}:{HTTP_WRAPPER_PORT}/health")
        print(f"   curl -X GET http://{ip}:{HTTP_WRAPPER_PORT}/memory/graph")

    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        print("🧹 You may need to clean up the droplet manually if it was created.")
        raise


if __name__ == "__main__":
    main()
