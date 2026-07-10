"""A read-only HTTP view over the store.

Other tools poll the tracker without shelling out to the CLI. The API only ever
reads: GET /tasks returns the whole list, GET /tasks/<id> returns one. There is
no POST, PUT, or DELETE on purpose. Mutation has a single path (the CLI), so the
API can never race it for the write, and a compromised reader can leak but never
corrupt. It rereads the store per request, which is fine at this scale.
"""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer

from store import Store

DB_PATH = "tasks.json"


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: object) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802 (stdlib naming)
        store = Store(DB_PATH).load()
        if self.path == "/tasks":
            self._send(200, {"tasks": [t.to_json() for t in store.tasks.values()]})
            return
        if self.path.startswith("/tasks/"):
            try:
                task_id = int(self.path.rsplit("/", 1)[1])
                self._send(200, store.get(task_id).to_json())
            except (ValueError, KeyError):
                self._send(404, {"error": "no such task"})
            return
        self._send(404, {"error": "not found"})

    def log_message(self, *_args: object) -> None:
        pass  # keep the test output quiet


def serve(host: str = "127.0.0.1", port: int = 8008) -> None:
    HTTPServer((host, port), Handler).serve_forever()
