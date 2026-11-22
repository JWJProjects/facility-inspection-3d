"""Check runtime provenance artifacts and path resolution without claiming a browser playtest."""
import functools
import hashlib
import http.server
from pathlib import Path
import json
import shutil
import tempfile
import threading
import unittest
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from urllib.request import urlopen

REPO = Path(__file__).resolve().parents[1]
WEB = REPO / "web"
RUNTIME = WEB / "runtime"

class Resources(HTMLParser):
    def __init__(self): super().__init__(); self.paths = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        key = {"script":"src","img":"src","link":"href"}.get(tag)
        if key and attrs.get(key): self.paths.append(attrs[key])

def attrs_from(path):
    r = Resources(); r.feed(path.read_text()); return r.paths

class StaticExport(unittest.TestCase):
    def test_studio_export_integrity_and_origin(self):
        faq = json.loads((RUNTIME/"files.json").read_text())
        runtime = json.loads((RUNTIME/"game"/"build.json").read_text())
        marker = json.loads((RUNTIME/"inspection-build.json").read_text())
        self.assertEqual(marker,{"schema":1,"entry":"./runtime/index.html"})
        self.assertEqual(faq["formatVersion"],1)
        self.assertEqual({"inspection-entry","inspection-equipment"},{s["id"] for s in runtime["scenes"]})
        self.assertEqual(json.loads((REPO/"studio-project"/"project.json").read_text())["engineVersion"],"0.6.0")
        for item in faq["files"]:
            with self.subTest(path=item["path"]):
                path = RUNTIME/item["path"]
                self.assertTrue(path.resolve().is_relative_to(RUNTIME))
                payload = path.read_bytes()
                self.assertEqual(len(payload),item["bytes"])
                self.assertEqual(hashlib.sha256(payload).hexdigest(),item["sha256"])
        self.assertEqual(
            {hashlib.sha256(f.read_bytes()).hexdigest() for f in (REPO/"art"/"source").glob("*.glb")},
            {hashlib.sha256((RUNTIME/"game"/v).read_bytes()).hexdigest() for v in runtime["assets"].values()}
        )

    def test_http_roots_and_local_references(self):
        with tempfile.TemporaryDirectory() as temp:
            shutil.copytree(WEB,Path(temp)/"nested"/"inspection")
            for directory,prefix in [(WEB,""),(temp,"nested/inspection/")]:
                class Quiet(http.server.SimpleHTTPRequestHandler):
                    def log_message(self,*args): pass
                handler = functools.partial(Quiet,directory=directory)
                with http.server.ThreadingHTTPServer(("127.0.0.1",0),handler) as server:
                    job=threading.Thread(target=server.serve_forever,daemon=True); job.start()
                    try:
                        self.request_paths(f"http://127.0.0.1:{server.server_port}/{prefix}")
                    finally:
                        server.shutdown(); job.join()
    def request_paths(self,base):
        export_src=urljoin(base,"runtime/")
        build=json.loads((RUNTIME/"game"/"build.json").read_text())
        groups = [
            (base, ["","runtime/inspection-build.json"]+attrs_from(WEB/"index.html")),
            (export_src, ["","files.json","game/build.json"]+attrs_from(RUNTIME/"index.html")),
            (urljoin(export_src,"game/"), [s["path"] for s in build["scenes"]]+list(build["assets"].values())+[build["scripts"]])
        ]
        for origin,paths in groups:
            for path in paths:
                with self.subTest(url=origin,path=path):
                    parsed=urlsplit(path)
                    self.assertFalse(parsed.scheme or parsed.netloc or path.startswith("/"))
                    with urlopen(urljoin(origin,path),timeout=5) as response:
                        self.assertEqual(response.status,200)
                        self.assertGreater(len(response.read()),0)

if __name__=="__main__": unittest.main()
