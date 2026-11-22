"""Original, deterministic glTF 2.0 props, meters / Y up / +Z front."""
import json, math, struct
from pathlib import Path

BASE = Path(__file__).resolve().parent / "source"
PALETTE = {
    "graphite": ("#242d32", .15, .53), "iron": ("#3d4b50", .25, .46),
    "silver": ("#a0a8a4", .25, .46), "paint": ("#237c7b", .12, .52),
    "patina": ("#16535b", .1, .66), "yellow": ("#f7b73c", .0, .45),
    "white": ("#eeebe0", .0, .46), "bezel": ("#10191c", .05, .7),
    "red": ("#e45838", .0, .42), "dial": ("#376065", .1, .39),
}
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def norm(a):
    n=math.sqrt(sum(x*x for x in a))
    return tuple(x/n for x in a)
def plus(a,b): return tuple(x+y for x,y in zip(a,b))
def mult(a,s): return tuple(x*s for x in a)
def lin(n):
    c=int(n,16)/255
    return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4

class Prop:
    def __init__(self): self.materials={}
    def tri(self,m,a,b,c):
        v=self.materials.setdefault(m,[])
        n=norm(cross(sub(b,a),sub(c,a)))
        v.extend([(p,n) for p in (a,b,c)])
    def quad(self,m,a,b,c,d): self.tri(m,a,b,c); self.tri(m,a,c,d)
    def box(self,m,x,y,z,w,h,d):
        p=[(x+sx*w/2,y+sy*h/2,z+sz*d/2) for sx,sy,sz in
            [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for ix in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]:
            self.quad(m,*(p[i] for i in ix))
    def cyl(self,m,a,b,r,n=16):
        e=norm(sub(b,a)); u=norm(cross((0,1,0) if abs(e[1])<.99 else (1,0,0),e)); v=cross(e,u)
        def rot(t): return plus(mult(u,r*math.cos(t)),mult(v,r*math.sin(t)))
        for i in range(n):
            d0,d1=rot(i*math.tau/n),rot((i+1)*math.tau/n)
            p0,p1,q0,q1=plus(a,d0),plus(a,d1),plus(b,d0),plus(b,d1)
            self.quad(m,p0,p1,q1,q0); self.tri(m,a,p1,p0); self.tri(m,b,q0,q1)
    def export(self,name):
        arrays=bytearray(); views=[]; access=[]; primitives=[]; materials=[]
        for label, vertices in self.materials.items():
            pair={}
            for i,k in enumerate(("POSITION","NORMAL")):
                values=[v[i] for v in vertices]; offset=len(arrays)
                for xyz in values: arrays.extend(struct.pack("<3f",*xyz))
                views.append({"buffer":0,"byteOffset":offset,"byteLength":len(arrays)-offset,"target":34962})
                a={"bufferView":len(views)-1,"componentType":5126,"count":len(values),"type":"VEC3"}
                if i==0: a.update(min=[min(v[j] for v in values) for j in range(3)], max=[max(v[j] for v in values) for j in range(3)])
                access.append(a); pair[k]=len(access)-1
            color,metal,rough=PALETTE[label]; rgb=[lin(color[i:i+2]) for i in (1,3,5)]
            materials.append({"name":label,"pbrMetallicRoughness":{"baseColorFactor":[*rgb,1],"metallicFactor":metal,"roughnessFactor":rough}})
            primitives.append({"attributes":pair,"material":len(materials)-1,"mode":4})
        doc={"asset":{"version":"2.0","generator":"JWJProjects 巡場 procedural props"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"name":name,"mesh":0}],"meshes":[{"name":name,"primitives":primitives}],"materials":materials,"accessors":access,"bufferViews":views,"buffers":[{"byteLength":len(arrays)}]}
        header=json.dumps(doc,separators=(",",":"),ensure_ascii=False).encode()
        header+=b" "*(-len(header)%4); arrays.extend(b"\0"*(-len(arrays)%4))
        (BASE/(name+".glb")).write_bytes(struct.pack("<4sII",b"glTF",2,28+len(header)+len(arrays))+struct.pack("<I4s",len(header),b"JSON")+header+struct.pack("<I4s",len(arrays),b"BIN\0")+arrays)

def skid():
    p=Prop()
    for x in (-.61,.61): p.box("graphite",x,.06,0,.19,.12,.76)
    for z in (-.32,.32): p.box("iron",0,.135,z,1.63,.1,.095)
    p.box("graphite",0,.23,0,1.66,.12,.8)
    p.box("yellow",0,.252,.409,1.58,.053,.02)
    p.box("iron",-.35,.4,-.025,.76,.27,.54)
    p.cyl("paint",(-.69,.64,0),(.07,.64,0),.272)
    p.cyl("patina",(-.735,.64,0),(-.69,.64,0),.281)
    for x in (-.63,-.526,-.421,-.317,-.212,-.108):
        p.cyl("patina",(x,.64,0),(x+.029,.64,0),.29,16)
    p.cyl("iron",(.06,.64,0),(.56,.64,0),.26)
    p.cyl("paint",(.38,.64,-.17),(.38,.64,.26),.304)
    p.cyl("iron",(.38,.64,.26),(.38,.64,.317),.284)
    p.cyl("silver",(.38,.64,.317),(.38,.64,.36),.171)
    p.cyl("bezel",(.38,.64,.36),(.38,.64,.378),.11)
    for a in range(0,360,60):
        t=math.radians(a); x=.38+.236*math.cos(t); y=.64+.236*math.sin(t)
        p.cyl("silver",(x,y,.315),(x,y,.344),.025,6)
    p.cyl("paint",(.38,.82,-.02),(.38,1.24,-.02),.13)
    p.cyl("iron",(.38,1.18,-.02),(.38,1.23,-.02),.175)
    p.cyl("paint",(.38,1.27,-.02),(.777,1.27,-.02),.13)
    p.cyl("paint",(.38,1.21,-.02),(.38,1.397,-.02),.132)
    p.cyl("silver",(.38,1.468,.131),(.38,1.468,.163),.101)
    p.cyl("white",(.38,1.468,.163),(.38,1.468,.165),.082)
    p.cyl("iron",(.38,1.316,-.02),(.38,1.418,-.02),.045,10)
    p.box("graphite",.4,1.487,.168,.05,.012,.01)
    p.cyl("iron",(.744,1.27,-.02),(.792,1.27,-.02),.173)
    p.box("iron",-.59,1.07,-.18,.13,1.03,.14)
    p.box("graphite",-.59,1.336,-.12,.4,.43,.23)
    p.box("white",-.59,1.336,.006,.334,.365,.028)
    p.box("bezel",-.59,1.432,.027,.239,.105,.018)
    p.box("dial",-.59,1.434,.04,.184,.048,.015)
    for x,m in [(-.675,"red"),(-.59,"bezel"),(-.505,"yellow")]:
        p.cyl("graphite",(x,1.295,.022),(x,1.295,.046),.027,12)
        p.cyl(m,(x,1.295,.045),(x,1.295,.055),.018,12)
    p.box("yellow",-.59,1.186,.03,.165,.035,.017)
    p.export("pump-skid")
def tank():
    p=Prop();p.pal=PALETTE
    for x in (-.41,.41):
        for z in (-.29,.29): p.box("iron",x,.184,z,.19,.368,.115)
    p.cyl("paint",(0,.36,0),(0,1.59,0),.485,20)
    for a,b in ((.35,.40),(1.55,1.61),(.58,.62),(1.34,1.38)):
        p.cyl("patina",(0,a,0),(0,b,0),.508,20)
    p.cyl("iron",(0,1.585,0),(0,1.717,0),.238,16)
    p.cyl("silver",(0,1.71,0),(0,1.775,0),.16,16)
    p.cyl("paint",(0,.75,.33),(0,.75,.56),.17)
    p.cyl("iron",(0,.75,.55),(0,.75,.607),.217)
    p.cyl("silver",(0,.75,.607),(0,.75,.626),.105)
    p.box("yellow",0,1.16,.489,.37,.121,.032)
    for x in (-.126,-.064,0,.064,.126):
        p.box("graphite",x,1.16,.515,.024,.069,.011)
    p.export("reservoir")
def cabinet():
    p=Prop()
    p.box("graphite",0,.076,0,.723,.152,.388)
    p.box("iron",0,.802,0,.747,1.405,.404)
    p.box("white",0,.81,.208,.658,1.308,.036)
    p.box("graphite",0,.815,.232,.01,1.26,.01)
    p.box("bezel",.145,1.225,.234,.245,.227,.038)
    p.box("dial",.145,1.242,.257,.179,.111,.019)
    p.box("yellow",-.18,1.32,.237,.208,.078,.025)
    for i in range(6): p.box("iron",-.157,.316+i*.047,.239,.2,.018,.021)
    for x,m in [(.075,"red"),(.14,"yellow"),(.207,"paint")]:
        p.cyl(m,(x,1.156,.252),(x,1.156,.276),.018,10)
    for x in (-.07,.07): p.box("graphite",x,.845,.251,.024,.15,.026)
    p.export("control-cabinet")

if __name__=="__main__":
    BASE.mkdir(exist_ok=True)
    skid(); tank(); cabinet()
