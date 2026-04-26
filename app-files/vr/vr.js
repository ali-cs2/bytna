import * as THREE from './vendor/three.module.js';
import { VRButton } from './vendor/VRButton.js';

const appElement = document.getElementById('vrApp');
const statusElement = document.getElementById('vrStatus');
const panoramaUrl = '../tiles/0-01/preview.jpg';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 0.01);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
appElement.appendChild(renderer.domElement);

const xrButton = VRButton.createButton(renderer);
xrButton.id = 'xrButton';
document.body.appendChild(xrButton);

const sphere = createPanoramaSphere();
scene.add(sphere);

const light = new THREE.AmbientLight(0xffffff, 1);
scene.add(light);

const dragState = {
  isDragging: false,
  pointerId: null,
  yaw: 0,
  pitch: 0,
  startX: 0,
  startY: 0,
  startYaw: 0,
  startPitch: 0
};

const loader = new THREE.TextureLoader();
loader.load(
  panoramaUrl,
  (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    sphere.material.uniforms.panoramaMap.value = texture;
    hideStatus();
  },
  undefined,
  () => {
    statusElement.textContent = 'Unable to load the VR panorama.';
  }
);

renderer.setAnimationLoop(() => {
  sphere.rotation.y = dragState.yaw;
  sphere.rotation.x = dragState.pitch;
  renderer.render(scene, camera);
});

window.addEventListener('resize', onResize);
renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

function createPanoramaSphere() {
  const geometry = new THREE.SphereGeometry(50, 96, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      panoramaMap: { value: null }
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform sampler2D panoramaMap;
      varying vec3 vWorldPosition;

      vec4 sampleVerticalCubeStrip(vec3 dir) {
        vec3 absDir = abs(dir);
        float ma;
        vec2 faceUv;
        float faceIndex;

        if (absDir.z >= absDir.x && absDir.z >= absDir.y) {
          ma = absDir.z;

          if (dir.z > 0.0) {
            faceIndex = 0.0; // b
            faceUv = vec2(dir.x, dir.y) / ma;
          } else {
            faceIndex = 1.0; // f
            faceUv = vec2(-dir.x, dir.y) / ma;
          }
        } else if (absDir.x >= absDir.y) {
          ma = absDir.x;

          if (dir.x > 0.0) {
            faceIndex = 3.0; // r
            faceUv = vec2(dir.z, dir.y) / ma;
          } else {
            faceIndex = 2.0; // l
            faceUv = vec2(-dir.z, dir.y) / ma;
          }
        } else {
          ma = absDir.y;

          if (dir.y > 0.0) {
            faceIndex = 4.0; // u
            faceUv = vec2(dir.x, -dir.z) / ma;
          } else {
            faceIndex = 5.0; // d
            faceUv = vec2(dir.x, dir.z) / ma;
          }
        }

        vec2 uv = faceUv * 0.5 + 0.5;
        uv.y = (uv.y + faceIndex) / 6.0;

        return texture2D(panoramaMap, uv);
      }

      void main() {
        vec3 direction = normalize(vWorldPosition - cameraPosition);
        gl_FragColor = sampleVerticalCubeStrip(direction);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  });

  return new THREE.Mesh(geometry, material);
}

function hideStatus() {
  statusElement.classList.add('is-hidden');
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerDown(event) {
  if (renderer.xr.isPresenting) {
    return;
  }

  dragState.isDragging = true;
  dragState.pointerId = event.pointerId;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.startYaw = dragState.yaw;
  dragState.startPitch = dragState.pitch;

  renderer.domElement.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!dragState.isDragging || dragState.pointerId !== event.pointerId || renderer.xr.isPresenting) {
    return;
  }

  const deltaX = event.clientX - dragState.startX;
  const deltaY = event.clientY - dragState.startY;

  dragState.yaw = dragState.startYaw - deltaX * 0.005;
  dragState.pitch = THREE.MathUtils.clamp(
    dragState.startPitch - deltaY * 0.0035,
    -Math.PI * 0.45,
    Math.PI * 0.45
  );
}

function onPointerUp(event) {
  if (dragState.pointerId !== event.pointerId) {
    return;
  }

  dragState.isDragging = false;
  dragState.pointerId = null;

  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
}
