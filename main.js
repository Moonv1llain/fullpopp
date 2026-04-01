import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

// 1. SCENE SETUP
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF5E6C8);
window._threeScene = scene;
window._THREE = THREE;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(-4.27, -0.31, 1.47); 

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#bg'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- BALANCED TONE MAPPING ---
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3; // Dropped back down for natural contrast

// 2. REFINED LIGHTING
// Side Highlight (Right)
const rectLight1 = new THREE.RectAreaLight(0xffffff, 8, 2, 10); 
rectLight1.position.set(6, 2, 4);
rectLight1.lookAt(0, 0, 0);
scene.add(rectLight1);

// Side Highlight (Left)
const rectLight2 = new THREE.RectAreaLight(0xffffff, 6, 2, 10); 
rectLight2.position.set(-6, 2, 4);
rectLight2.lookAt(0, 0, 0);
scene.add(rectLight2);

// Subtle Top Down Light
const topLight = new THREE.DirectionalLight(0xffffff, 1.5);
topLight.position.set(0, 8, 2);
scene.add(topLight);

// Gentle Fill
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// 3. MASTER GROUP
const masterGroup = new THREE.Group();
scene.add(masterGroup);

let canTexture;
const loader = new GLTFLoader();

// --- 4. DROP GENERATOR ---
const addUltraDrops = (model) => {
    const dropGeometry = new THREE.SphereGeometry(0.015, 12, 12); 
    const dropMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 1.0,
        ior: 1.33,
        thickness: 0.02,
        roughness: 0,
        envMapIntensity: 1.5 
    });

    const totalDrops = 2500;
    const instancedMesh = new THREE.InstancedMesh(dropGeometry, dropMaterial, totalDrops);
    const raycaster = new THREE.Raycaster();
    const dummy = new THREE.Object3D();
    const box = new THREE.Box3().setFromObject(model);
    const height = (box.max.y - box.min.y);

    let count = 0;
    while (count < totalDrops) {
        const angle = Math.random() * Math.PI * 2;
        const randomY = (Math.random() - 0.5) * height;
        const origin = new THREE.Vector3(Math.cos(angle) * 5, randomY, Math.sin(angle) * 5);
        const direction = new THREE.Vector3(0, randomY, 0).sub(origin).normalize();
        raycaster.set(origin, direction);
        const intersects = raycaster.intersectObject(model, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            dummy.position.copy(hit.point);
            dummy.lookAt(hit.point.clone().add(hit.normal));
            const s = 0.5 + Math.random() * 0.8;
            dummy.scale.set(s, s, s * 0.4); 
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(count, dummy.matrix);
            count++;
        }
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    masterGroup.add(instancedMesh);
};

// --- 5. THE LOADER ---
loader.load('fullpopp.glb', (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scaleFactor = 3.8 / Math.max(size.x, size.y, size.z);
    
    model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    model.position.set(-center.x * scaleFactor, -center.y * scaleFactor, -center.z * scaleFactor);
    masterGroup.add(model);

    masterGroup.rotation.x = -0.15; 
    masterGroup.rotation.y = 0.00;

    model.traverse((node) => {
        if (node.isMesh) {
            // BACK TO METALLIC LOOK
            node.material.metalness = 0.7; 
            node.material.roughness = 0.18; 
            node.material.envMapIntensity = 1.5; 
            node.material.clearcoat = 0.8;
        }
    });

    addUltraDrops(model);
}, undefined, (error) => console.error(error));

// 6. CONTROLS
const isMobile = window.matchMedia('(max-width: 768px)').matches;
const orbitTarget = isMobile
    ? (document.querySelector('.mobile-scroller') || renderer.domElement)
    : renderer.domElement;

const controls = new OrbitControls(camera, orbitTarget);
controls.enableDamping = true;
controls.minPolarAngle = Math.PI / 2.1;
controls.maxPolarAngle = Math.PI / 1.7;

// Override OrbitControls' touch-action:none so the scroller can still scroll vertically
if (isMobile) {
    orbitTarget.style.touchAction = 'pan-y';
}

// 7. ANIMATION
function animate(time) {
    requestAnimationFrame(animate);

    if (masterGroup) {
        const pulse = 1 + Math.sin(time * 0.002) * 0.012;
        masterGroup.scale.set(pulse, pulse, pulse);
    }

    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(0);