"""Offline structural checks for the original GLB kit."""
import hashlib
import json
import math
import struct
import subprocess
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"art"/"source"
BOUNDS={"pump-skid":(1.66,1.55,.85),"reservoir":(1.02,1.78,1.14),"control-cabinet":(.75,1.51,.49)}

def read_glb(data):
    signature,version,length=struct.unpack_from("<4sII",data)
    assert (signature,version,length)==(b"glTF",2,len(data))
    size,typ=struct.unpack_from("<I4s",data,12)
    assert typ==b"JSON" and size%4==0
    doc=json.loads(data[20:20+size])
    nbytes,kind=struct.unpack_from("<I4s",data,20+size)
    assert kind==b"BIN\0" and nbytes==len(data)-(28+size)
    return doc,memoryview(data)[28+size:]

def xyz(doc, raw, accessor_id):
    a=doc["accessors"][accessor_id]
    assert a["componentType"]==5126 and a["type"]=="VEC3"
    v=doc["bufferViews"][a["bufferView"]]
    i=v.get("byteOffset",0)+a.get("byteOffset",0)
    return tuple(struct.iter_unpack("<3f",raw[i:i+v["byteLength"]]))

class AssetTests(unittest.TestCase):
    def test_geometry_materials_and_static_budget(self):
        self.assertEqual(set(p.stem for p in SOURCE.glob("*.glb")),set(BOUNDS))
        self.assertLessEqual(sum(p.stat().st_size for p in SOURCE.glob("*.glb")),262144)
        for name,bounds in BOUNDS.items():
            with self.subTest(name=name):
                doc,binary=read_glb((SOURCE/f"{name}.glb").read_bytes())
                self.assertEqual(doc["asset"]["version"],"2.0")
                self.assertEqual(doc["nodes"],[{"name":name,"mesh":0}])
                self.assertNotIn("images",doc)
                self.assertTrue(all("uri" not in buffer for buffer in doc["buffers"]))
                positions=[]
                for primitive in doc["meshes"][0]["primitives"]:
                    self.assertEqual(primitive["mode"],4)
                    self.assertLess(primitive["material"],len(doc["materials"]))
                    p=xyz(doc,binary,primitive["attributes"]["POSITION"])
                    normals=xyz(doc,binary,primitive["attributes"]["NORMAL"])
                    self.assertEqual(len(p),len(normals))
                    self.assertEqual(len(p)%3,0)
                    self.assertTrue(all(abs(math.sqrt(sum(x*x for x in n))-1)<1e-5 for n in normals))
                    positions.extend(p)
                self.assertAlmostEqual(min(v[1] for v in positions),0,places=5)
                for axis,expected in enumerate(bounds):
                    actual=max(v[axis] for v in positions)-min(v[axis] for v in positions)
                    self.assertLessEqual(abs(actual-expected),.075)

    def test_binary_assets_reproduce_exactly(self):
        paths=sorted(SOURCE.glob("*.glb"))
        before=[hashlib.sha256(p.read_bytes()).hexdigest() for p in paths]
        subprocess.run([sys.executable,"-I",str(ROOT/"art"/"build_props.py")],check=True)
        self.assertEqual(before,[hashlib.sha256(p.read_bytes()).hexdigest() for p in paths])

if __name__=="__main__":
    unittest.main()
