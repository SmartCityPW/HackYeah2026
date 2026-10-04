#!/usr/bin/env python3
"""Renderuje modele 3D Spryciaków (frontend/public/models/spryciaki/*.glb) do przezroczystych PNG dla prezentacji.

Zależności: pip install playwright && playwright install chromium; three.js bierzemy z frontend/node_modules (npm install).
Wynik: assets/spryciaki/<kod>.png (Spryciaki), assets/rare/gold_bike.png (rower w złocie) oraz assets/enemies/<kod>.png (przeciwnicy złożeni z modeli 3D).
Oświetlenie i kadr Spryciaków jak w miniaturach aplikacji (model-preview.ts).
"""
import base64
import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
FRONTEND = HERE.parent.parent / "frontend"
OUT = HERE / "assets" / "spryciaki"
SIZE = 400
# Przeciwnicy (backend/config/seed/reference.yaml, enemy_types) nie mają własnych modeli 3D, więc składamy je z istniejących:
# Korek Komunikacyjny to auta na skrzyżowaniu, Śmieciowy Potwór to kontener na śmieci (inny model niż kosz-Spryciak).
JAM = [("car", -0.55, 0.62, 0.0), ("suv", -0.5, -0.62, 0.0), ("van", 0.6, 0.55, 0.12), ("small_car", 0.65, -0.62, -0.1)]

PAGE = """<!doctype html><html><body style="margin:0"><canvas id="c" width="%(s)d" height="%(s)d"></canvas>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const renderer = new THREE.WebGLRenderer({canvas: document.getElementById('c'), antialias: true, alpha: true, preserveDrawingBuffer: true});
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-1, 2, 1.5); scene.add(sun);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 5000);
window.renderModel = async (path, yaw, tint) => {
  const gltf = await new GLTFLoader().loadAsync(path);
  const obj = gltf.scene;
  if (tint) {  // rzadka odmiana: barwne części tekstury (rama) w złocie, szarości i czerń (opony, szprychy) zostają
    obj.traverse((n) => {
      if (!n.isMesh || !n.material.map) return;
      const img = n.material.map.image;
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      const px = data.data, gold = new THREE.Color(tint), hsl = {}, c = new THREE.Color();
      for (let i = 0; i < px.length; i += 4) {
        c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
        if (hsl.s < 0.25) continue;
        gold.getHSL(hsl.__g = hsl.__g || {}, THREE.SRGBColorSpace);
        c.setHSL(hsl.__g.h, Math.min(1, hsl.__g.s), Math.min(0.7, Math.max(0.56, hsl.l + 0.22)), THREE.SRGBColorSpace);
        px[i] = c.r * 255; px[i + 1] = c.g * 255; px[i + 2] = c.b * 255;
      }
      ctx.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(cv);
      tex.flipY = n.material.map.flipY; tex.colorSpace = THREE.SRGBColorSpace;
      n.material = n.material.clone(); n.material.map = tex;
    });
  }
  const box = new THREE.Box3().setFromObject(obj);
  obj.position.sub(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2));
  const holder = new THREE.Group(); holder.add(obj); holder.rotation.y = yaw; scene.add(holder);
  const sphere = new THREE.Box3().setFromObject(holder).getBoundingSphere(new THREE.Sphere());
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
  camera.position.set(0, sphere.center.y + dist * 0.25, dist);
  camera.lookAt(0, sphere.center.y, 0);
  renderer.render(scene, camera);
  scene.remove(holder);
  return renderer.domElement.toDataURL('image/png');
};
// Scena z kilku modeli (np. korek: auta na skrzyżowaniu). Każdy model skalujemy do tej samej długości, żeby auta były podobnej wielkości.
// items: [{path, x, z, rot}] - przesunięcie w jednostkach długości auta i obrót wokół osi pionowej (radiany).
window.renderGroup = async (items, yaw, pitch, length) => {
  const loader = new GLTFLoader();
  const holder = new THREE.Group();
  for (const it of items) {
    const obj = (await loader.loadAsync(it.path)).scene;
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    obj.scale.setScalar(length / Math.max(size.x, size.z));
    const b = new THREE.Box3().setFromObject(obj);
    obj.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    const slot = new THREE.Group();
    slot.add(obj);
    slot.rotation.y = it.rot;
    slot.position.set(it.x * length, 0, it.z * length);
    holder.add(slot);
  }
  holder.rotation.y = yaw;
  scene.add(holder);
  const sphere = new THREE.Box3().setFromObject(holder).getBoundingSphere(new THREE.Sphere());
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
  camera.position.set(0, sphere.center.y + dist * pitch, dist);
  camera.lookAt(0, sphere.center.y, 0);
  renderer.render(scene, camera);
  scene.remove(holder);
  return renderer.domElement.toDataURL('image/png');
};
window.ready = true;
</script></body></html>""" % {"s": SIZE}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    models = sorted((FRONTEND / "public" / "models" / "spryciaki").glob("*.glb"))

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(FRONTEND))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    # strona renderująca musi leżeć w katalogu serwera, żeby importmap sięgała do /node_modules
    page_file = FRONTEND / "__render_spryciaki.html"
    page_file.write_text(PAGE, encoding="utf8")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            page = browser.new_page()
            page.goto(f"{base}/__render_spryciaki.html")
            page.wait_for_function("window.ready === true")
            for model in models:
                data = page.evaluate("([path, yaw, tint]) => window.renderModel(path, yaw, tint)", [f"/public/models/spryciaki/{model.name}", 0.65, None])
                (OUT / f"{model.stem}.png").write_bytes(base64.b64decode(data.split(",", 1)[1]))
                print("ok", model.stem)
            # Złoty Rower (rzadki Spryciak z wydarzeń) nie ma jeszcze własnego modelu: pokazujemy rower w złocie
            rare = OUT.parent / "rare"
            rare.mkdir(exist_ok=True)
            data = page.evaluate("([path, yaw, tint]) => window.renderModel(path, yaw, tint)", ["/public/models/spryciaki/bicycle.glb", 0.65, "#f5c518"])
            (rare / "gold_bike.png").write_bytes(base64.b64decode(data.split(",", 1)[1]))
            print("ok gold_bike")
            (HERE / "assets" / "enemies").mkdir(parents=True, exist_ok=True)
            models_url = "/public/models/spryciaki/"
            jam = [{"path": f"{models_url}{name}.glb", "x": x, "z": z, "rot": rot} for name, x, z, rot in JAM]
            data = page.evaluate("([items, yaw, pitch, length]) => window.renderGroup(items, yaw, pitch, length)", [jam, 0.6, 0.5, 4.0])
            (HERE / "assets" / "enemies" / "traffic_jam.png").write_bytes(base64.b64decode(data.split(",", 1)[1]))
            data = page.evaluate("([path, yaw, tint]) => window.renderModel(path, yaw, tint)", [f"{models_url}dumpster.glb", 0.65, None])
            (HERE / "assets" / "enemies" / "trash_beast.png").write_bytes(base64.b64decode(data.split(",", 1)[1]))
            print("ok enemies")
            browser.close()
    finally:
        page_file.unlink(missing_ok=True)
        server.shutdown()


if __name__ == "__main__":
    main()
