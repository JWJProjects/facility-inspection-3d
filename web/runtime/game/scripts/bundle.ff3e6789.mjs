// .studio/studio-runtime-shim.mjs
var api = globalThis.__STUDIO_SCRIPT_API__;
if (!api) throw new Error("The studio script API is not available on this page.");
if (api.version !== 2) {
  throw new Error(
    "These scripts were compiled against version 2 of the studio API, but version " + api.version + " is running. Rebuild the project's scripts."
  );
}
var Behaviour = api.Behaviour;
var registerScript = api.registerScript;

// assets/scripts/InspectionWalkthrough.ts
var CHANNEL = "xunchang-v1";
var TAU = Math.PI * 2;
var STATUS = {
  far: "\u8DDD\u96E2\u592A\u9060\uFF0C\u8ACB\u8D70\u5230\u9580\u724C 01 \u524D",
  near: "\u5DF2\u5230\u9580\u524D\uFF0C\u6309 E \u958B\u9580",
  opening: "\u9580\u6247\u958B\u555F\u4E2D\uFF0C\u8ACB\u5728\u9580\u524D\u7A0D\u5019",
  open: "\u9580\u5DF2\u958B\u555F\uFF0C\u5411\u524D\u8D70\u5230\u8A2D\u5099 02",
  inspect: "\u5DF2\u5230\u8A2D\u5099 02\uFF0C\u6309 E \u67E5\u770B\u8A2D\u5099",
  observed: "P-02\uFF5C\u6307\u793A\u71C8\u4E0D\u4EAE\uFF0C\u8ACB\u8A18\u9304\u8B80\u503C",
  error: "\u7121\u6CD5\u8F09\u5165\u958B\u9580\u5834\u666F\uFF0C\u8ACB\u91CD\u65B0\u958B\u59CB"
};
var clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
var InspectionWalkthrough = class extends Behaviour {
  static properties = {
    player: { type: "entity", label: "\u5DE1\u6AA2\u4EBA\u54E1" },
    gateZone: { type: "entity", label: "01 \u4E92\u52D5\u5340\u4E2D\u5FC3" },
    gateHinge: { type: "entity", label: "01 \u9580\u9278\u93C8" },
    equipmentZone: { type: "entity", label: "02 \u4E92\u52D5\u5340\u4E2D\u5FC3" },
    openScene: { type: "string", label: "\u958B\u9580\u5834\u666F ID" },
    gateIsOpen: { type: "boolean", label: "\u6B64\u5834\u666F\u5DF2\u958B\u9580", default: false },
    gateHalfWidth: { type: "number", label: "01 \u5340\u57DF\u534A\u5BEC\uFF08m\uFF09", default: 1.15, min: 0.1, max: 8 },
    gateHalfDepth: { type: "number", label: "01 \u5340\u57DF\u534A\u6DF1\uFF08m\uFF09", default: 1.05, min: 0.1, max: 8 },
    equipmentHalfWidth: { type: "number", label: "02 \u5340\u57DF\u534A\u5BEC\uFF08m\uFF09", default: 1.6, min: 0.1, max: 8 },
    equipmentHalfDepth: { type: "number", label: "02 \u5340\u57DF\u534A\u6DF1\uFF08m\uFF09", default: 1.05, min: 0.1, max: 8 }
  };
  player = "";
  gateZone = "";
  gateHinge = "";
  equipmentZone = "";
  openScene = "";
  gateIsOpen = false;
  gateHalfWidth = 1.15;
  gateHalfDepth = 1.05;
  equipmentHalfWidth = 1.6;
  equipmentHalfDepth = 1.05;
  observed = false;
  heldE = true;
  insideGate = false;
  insideEquipment = false;
  opening = false;
  elapsed = 0;
  switched = false;
  title;
  action;
  container;
  marker;
  prefersReduced = false;
  origin = window.location.origin;
  qa = new URLSearchParams(window.location.search).get("qa") === "1";
  previousStatus = "";
  cover;
  playButton;
  webPlay = () => {
    this.wait(() => this.announce(), 100);
  };
  attempts = 0;
  rejected = 0;
  preload;
  parentMessage = (event) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== this.origin || this.origin === "null") return;
    const msg = event.data;
    if (!msg || typeof msg !== "object" || msg.channel !== CHANNEL) return;
    if (msg.type === "hello") this.announce();
    else if (msg.type === "gate-action" && !this.gateIsOpen) this.interact();
    else if (msg.type === "inspect-equipment" && this.gateIsOpen) this.interact();
  };
  onStart() {
    this.prefersReduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.container = document.createElement("div");
    this.container.className = "inspection-runtime-hud";
    Object.assign(this.container.style, {
      position: "absolute",
      zIndex: "99",
      left: "16px",
      right: "16px",
      bottom: document.querySelector("[data-viewport-stage]") ? "33px" : "18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      font: "650 15px system-ui,sans-serif",
      pointerEvents: "none"
    });
    this.title = document.createElement("div");
    this.title.setAttribute("role", "status");
    Object.assign(this.title.style, { display: "inline-block", background: "#171a1d", color: "#fff", padding: "10px 13px", border: "1px solid #656c74", borderRadius: "5px" });
    this.action = document.createElement("button");
    this.action.type = "button";
    this.action.addEventListener("click", () => this.interact());
    this.action.textContent = this.gateIsOpen ? "\u67E5\u770B\u8A2D\u5099" : "\u958B\u555F\u5DE1\u6AA2\u9580";
    Object.assign(this.action.style, { background: "#ffc400", color: "#171a1d", padding: "10px 12px", border: "2px solid #171a1d", borderRadius: "5px", font: "inherit", minHeight: "48px", pointerEvents: "auto" });
    this.container.append(this.title, this.action);
    const editorViewport = document.querySelector("[data-viewport-stage]");
    const mount = document.querySelector("#view")?.parentElement ?? editorViewport ?? document.body;
    this.cover = document.querySelector("#overlay");
    this.playButton = document.querySelector("#start");
    this.playButton?.addEventListener("click", this.webPlay);
    if (mount !== document.body && getComputedStyle(mount).position === "static") mount.style.position = "relative";
    mount.append(this.container);
    this.marker = document.createElement("span");
    this.marker.setAttribute("aria-hidden", "true");
    this.marker.textContent = "+";
    Object.assign(this.marker.style, { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: "20", pointerEvents: "none", font: "600 22px system-ui", color: "#fff", textShadow: "1px 1px #171a1d" });
    mount.append(this.marker);
    const readyType = this.gateIsOpen ? "gate-open" : "ready";
    if (!this.gateIsOpen) {
      this.refresh(STATUS.far);
      if (this.scenes && this.openScene) {
        this.preload = this.scenes.load(this.openScene);
        void this.preload.ready.catch(() => {
          this.preload = void 0;
        });
      }
    } else {
      this.refresh(STATUS.open);
    }
    window.addEventListener("message", this.parentMessage);
    this.wait(() => {
      this.announce();
      if (readyType === "gate-open") {
        this.send("gate-open");
        this.log("[\u5DE1\u5834] GATE_OPEN_SCENE_LIVE");
      } else this.log("[\u5DE1\u5834] CLOSED_SCENE_LIVE");
    }, 45);
  }
  send(type, detail = {}) {
    if ((!this.cover || this.cover.hidden) && window.parent !== window && this.origin !== "null") window.parent.postMessage({ channel: CHANNEL, type, ...detail }, this.origin);
  }
  announce() {
    this.send("ready");
    this.send("gate-range", { inRange: this.insideGate });
    this.send("equipment-range", { inRange: this.insideEquipment });
    if (this.gateIsOpen) this.send("gate-open");
    if (this.observed) this.send("equipment-observed");
  }
  refresh(label) {
    if (!this.title || label === this.previousStatus) return;
    this.previousStatus = label;
    this.title.textContent = label;
  }
  inZone(x, z, center, w, d) {
    return center !== void 0 && Math.abs(x - center.x) <= w && Math.abs(z - center.z) <= d;
  }
  interact() {
    if (this.gateIsOpen) {
      if (!this.insideEquipment) {
        this.send("equipment-denied");
        return;
      }
      if (this.observed) return;
      this.observed = true;
      this.refresh(STATUS.observed);
      this.send("equipment-observed");
      this.log("[\u5DE1\u5834] EQUIPMENT_OBSERVED P-02");
    } else {
      if (this.opening) return;
      this.attempts++;
      if (!this.insideGate) {
        this.rejected++;
        this.send("gate-denied");
        this.refresh(STATUS.far);
        this.log("[\u5DE1\u5834] GATE_ACTION_REJECTED_OUTSIDE_ZONE");
        return;
      }
      if (!this.scenes || !this.openScene) {
        this.refresh(STATUS.error);
        return;
      }
      this.opening = true;
      this.elapsed = 0;
      this.refresh(STATUS.opening);
      this.log("[\u5DE1\u5834] GATE_ACTION_ACCEPTED");
    }
  }
  onUpdate(delta) {
    const player = this.resolve(this.player)?.object.position;
    if (!player) return;
    if (this.container) this.container.style.visibility = this.cover && !this.cover.hidden ? "hidden" : "visible";
    if (this.marker) this.marker.style.visibility = this.cover && !this.cover.hidden ? "hidden" : "visible";
    const inGate = !this.gateIsOpen && this.inZone(player.x, player.z, this.resolve(this.gateZone)?.object.position, this.gateHalfWidth, this.gateHalfDepth);
    const inEquipment = this.gateIsOpen && this.inZone(player.x, player.z, this.resolve(this.equipmentZone)?.object.position, this.equipmentHalfWidth, this.equipmentHalfDepth);
    if (inGate !== this.insideGate) {
      this.insideGate = inGate;
      this.send("gate-range", { inRange: inGate });
    }
    if (inEquipment !== this.insideEquipment) {
      this.insideEquipment = inEquipment;
      this.send("equipment-range", { inRange: inEquipment });
    }
    if (this.action) this.action.disabled = this.gateIsOpen ? this.observed || !inEquipment : this.opening || !inGate;
    if (!this.opening) this.refresh(this.gateIsOpen ? this.observed ? STATUS.observed : inEquipment ? STATUS.inspect : STATUS.open : inGate ? STATUS.near : STATUS.far);
    const key = (!this.cover || this.cover.hidden) && this.input.isDown("KeyE");
    if (key && !this.heldE) this.interact();
    this.heldE = key;
    if (this.opening && !this.switched) {
      this.elapsed += delta;
      const duration = this.prefersReduced ? 0.02 : 0.78;
      const t = clamp(this.elapsed / duration, 0, 1);
      const hinge = this.resolve(this.gateHinge)?.object;
      if (hinge) hinge.rotation.y = TAU / 4 * (1 - Math.pow(1 - t, 3));
      if (t >= 1) {
        this.switched = true;
        const transition = this.preload?.activate() ?? this.scenes?.go(this.openScene);
        void transition?.catch(() => {
          this.refresh(STATUS.error);
          this.log("[\u5DE1\u5834] GATE_OPEN_SCENE_FAILED");
        });
      }
    }
    if (this.qa && this.container) {
      Object.assign(this.container.dataset, { playerX: player.x.toFixed(3), playerZ: player.z.toFixed(3), gateOpen: String(this.gateIsOpen), gateRange: String(this.insideGate), equipmentRange: String(this.insideEquipment), attempts: String(this.attempts), rejected: String(this.rejected), opening: String(this.opening), observed: String(this.observed) });
    }
  }
  onDestroy() {
    this.playButton?.removeEventListener("click", this.webPlay);
    this.container?.remove();
    this.marker?.remove();
    window.removeEventListener("message", this.parentMessage);
  }
};

// .studio/script-entry.mjs
if (typeof InspectionWalkthrough === "function") registerScript("inspection-InspectionWalkthrough", InspectionWalkthrough);
