import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const files = {
  "node_modules/three/build/three.module.min.js": "vendor/three/three.module.min.js",
  "node_modules/three/build/three.core.min.js": "vendor/three/three.core.min.js",
  "node_modules/three/examples/jsm/postprocessing/EffectComposer.js": "vendor/three/addons/postprocessing/EffectComposer.js",
  "node_modules/three/examples/jsm/postprocessing/RenderPass.js": "vendor/three/addons/postprocessing/RenderPass.js",
  "node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js": "vendor/three/addons/postprocessing/UnrealBloomPass.js",
  "node_modules/three/examples/jsm/postprocessing/OutputPass.js": "vendor/three/addons/postprocessing/OutputPass.js",
  "node_modules/three/examples/jsm/postprocessing/Pass.js": "vendor/three/addons/postprocessing/Pass.js",
  "node_modules/three/examples/jsm/postprocessing/ShaderPass.js": "vendor/three/addons/postprocessing/ShaderPass.js",
  "node_modules/three/examples/jsm/postprocessing/MaskPass.js": "vendor/three/addons/postprocessing/MaskPass.js",
  "node_modules/three/examples/jsm/shaders/CopyShader.js": "vendor/three/addons/shaders/CopyShader.js",
  "node_modules/three/examples/jsm/shaders/LuminosityHighPassShader.js": "vendor/three/addons/shaders/LuminosityHighPassShader.js",
  "node_modules/three/examples/jsm/shaders/OutputShader.js": "vendor/three/addons/shaders/OutputShader.js",
  "node_modules/three/LICENSE": "vendor/three/LICENSE",
};

for (const [source, destination] of Object.entries(files)) {
  const destinationPath = resolve(root, destination);
  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(resolve(root, source), destinationPath);
}

console.log("Three.js runtime vendored: " + Object.keys(files).length + " files");
