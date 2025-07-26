#!/usr/bin/env python3
"""
HTTP wrapper for MCP Memory Server using stdio transport.
This creates a stable HTTP API around the MCP memory server for remote access.
"""

import json
import subprocess
import sys
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MCPCommunicator:
    """Handles communication with the MCP memory server via stdio."""

    def __init__(self):
        self.process: Optional[subprocess.Popen[str]] = None
        self.request_id = 0
        self._lock = asyncio.Lock()

    async def start_mcp_server(self) -> bool:
        """Start the MCP memory server process."""
        try:
            # In containerized environment, run the Node.js MCP server directly
            # In system environment, use Docker
            import os
            if os.path.exists('/usr/local/bin/mcp-server-memory'):
                # Containerized environment - run Node.js directly
                cmd = ["node", "/usr/local/bin/mcp-server-memory"]
            else:
                # System environment - use Docker
                cmd = ["docker", "run", "-i", "--rm", "mcp/memory:latest"]
            
            self.process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0,
            )
            logger.info(f"MCP memory server started with command: {' '.join(cmd)}")

            # Initialize the server
            init_result = await self.send_request(
                {
                    "jsonrpc": "2.0",
                    "id": self._next_id(),
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "clientInfo": {"name": "http-wrapper", "version": "1.0.0"},
                    },
                }
            )

            if "error" in init_result:
                logger.error(f"Initialization failed: {init_result['error']}")
                return False

            # Send initialized notification
            await self.send_notification(
                {"jsonrpc": "2.0", "method": "notifications/initialized"}
            )

            return True
        except Exception as e:
            logger.error(f"Failed to start MCP server: {e}")
            if self.process:
                self.process.terminate()
                self.process = None
            return False

    def _next_id(self) -> int:
        """Get next request ID."""
        self.request_id += 1
        return self.request_id

    async def send_notification(self, notification: Dict[str, Any]) -> None:
        """Send a notification to the MCP server."""
        if not self.process or not self.process.stdin:
            raise RuntimeError("MCP server not started")

        async with self._lock:
            try:
                notification_str = json.dumps(notification) + "\n"
                self.process.stdin.write(notification_str)
                self.process.stdin.flush()
                logger.debug(f"Sent notification: {notification['method']}")
            except Exception as e:
                logger.error(f"Error sending notification: {e}")
                raise

    async def send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Send a request to the MCP server and get response."""
        if not self.process or not self.process.stdin or not self.process.stdout:
            raise RuntimeError("MCP server not started")

        async with self._lock:
            try:
                # Send request
                request_str = json.dumps(request) + "\n"
                self.process.stdin.write(request_str)
                self.process.stdin.flush()

                # Read response
                response_str = self.process.stdout.readline().strip()
                if not response_str:
                    raise RuntimeError("No response from MCP server")

                response = json.loads(response_str)
                logger.debug(
                    f"MCP Request: {request.get('method')}, Response ID: {response.get('id')}"
                )

                return response
            except Exception as e:
                logger.error(f"Error communicating with MCP server: {e}")
                raise

    async def stop_mcp_server(self) -> None:
        """Stop the MCP server process."""
        if self.process:
            try:
                self.process.terminate()
                await asyncio.sleep(1)  # Give it time to terminate gracefully
                if self.process.poll() is None:
                    self.process.kill()
                self.process.wait()
            except Exception as e:
                logger.error(f"Error stopping MCP server: {e}")
            finally:
                self.process = None
            logger.info("MCP memory server stopped")


# Global MCP communicator
mcp = MCPCommunicator()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # Startup
    success = await mcp.start_mcp_server()
    if not success:
        logger.error("Failed to start MCP server during startup")
        sys.exit(1)

    yield

    # Shutdown
    await mcp.stop_mcp_server()


app = FastAPI(
    title="MCP Memory Server HTTP Wrapper",
    description="HTTP API wrapper for MCP Memory Server using stdio transport",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> Dict[str, Any]:
    """Root endpoint with server info."""
    return {
        "service": "MCP Memory Server HTTP Wrapper",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "mcp_server_status": "running" if mcp.process else "stopped",
        "endpoints": {
            "health": "/health",
            "memory": {
                "create_entities": "POST /memory/entities",
                "create_relations": "POST /memory/relations",
                "add_observations": "POST /memory/observations",
                "search": "GET /memory/search?q=query",
                "read_graph": "GET /memory/graph",
                "open_nodes": "GET /memory/nodes?names=name1,name2",
            },
        },
    }


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "mcp_server": "running" if mcp.process else "stopped",
        "timestamp": datetime.now().isoformat(),
    }


# Convenience endpoints for common memory operations
@app.post("/memory/entities")
async def create_entities(entities: list[Dict[str, Any]]) -> Dict[str, Any]:
    """Create entities in the knowledge graph."""
    request = {
        "jsonrpc": "2.0",
        "id": mcp.request_id + 1,
        "method": "tools/call",
        "params": {"name": "create_entities", "arguments": {"entities": entities}},
    }

    response = await mcp.send_request(request)
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])

    return response.get("result", {})


@app.post("/memory/relations")
async def create_relations(relations: list[Dict[str, Any]]) -> Dict[str, Any]:
    """Create relations between entities."""
    request = {
        "jsonrpc": "2.0",
        "id": mcp.request_id + 1,
        "method": "tools/call",
        "params": {"name": "create_relations", "arguments": {"relations": relations}},
    }

    response = await mcp.send_request(request)
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])

    return response.get("result", {})


@app.post("/memory/observations")
async def add_observations(observations: list[Dict[str, Any]]) -> Dict[str, Any]:
    """Add observations to entities."""
    request = {
        "jsonrpc": "2.0",
        "id": mcp.request_id + 1,
        "method": "tools/call",
        "params": {
            "name": "add_observations",
            "arguments": {"observations": observations},
        },
    }

    response = await mcp.send_request(request)
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])

    return response.get("result", {})


@app.get("/memory/search")
async def search_memory(q: str) -> Dict[str, Any]:
    """Search the knowledge graph."""
    request = {
        "jsonrpc": "2.0",
        "id": mcp.request_id + 1,
        "method": "tools/call",
        "params": {"name": "search_nodes", "arguments": {"query": q}},
    }

    response = await mcp.send_request(request)
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])

    return response.get("result", {})


@app.get("/memory/graph")
async def read_graph() -> Dict[str, Any]:
    """Read the entire knowledge graph."""
    request = {
        "jsonrpc": "2.0",
        "id": mcp.request_id + 1,
        "method": "tools/call",
        "params": {"name": "read_graph", "arguments": {}},
    }

    response = await mcp.send_request(request)
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])

    return response.get("result", {})


@app.get("/memory/nodes")
async def open_nodes(names: str) -> Dict[str, Any]:
    """Open specific nodes by name."""
    name_list = [name.strip() for name in names.split(",")]

    request = {
        "jsonrpc": "2.0",
        "id": mcp.request_id + 1,
        "method": "tools/call",
        "params": {"name": "open_nodes", "arguments": {"names": name_list}},
    }

    response = await mcp.send_request(request)
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])

    return response.get("result", {})


@app.delete("/memory/entities")
async def delete_entities(entity_names: list[str]) -> Dict[str, Any]:
    """Delete entities from the knowledge graph."""
    request = {
        "jsonrpc": "2.0",
        "id": mcp.request_id + 1,
        "method": "tools/call",
        "params": {
            "name": "delete_entities",
            "arguments": {"entityNames": entity_names},
        },
    }

    response = await mcp.send_request(request)
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])

    return response.get("result", {})


if __name__ == "__main__":
    uvicorn.run(
        "http_mcp_wrapper:app",
        host="0.0.0.0",
        port=8080,
        log_level="info",
        access_log=True,
    )
