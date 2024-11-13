import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "lil-gui";
import * as CANNON from "cannon-es";

const gui = new dat.GUI();

const canvas = document.querySelector("canvas.webgl");

const scene = new THREE.Scene();

const hitSound = new Audio("/sounds/hit.mp3");

let lastPlayTime = 0;

const playHitSound = (collision) => {
  const now = Date.now();
  if (now - lastPlayTime < 50) return;

  const collisionVelocity = collision.contact.getImpactVelocityAlongNormal();
  if (collisionVelocity > 0.6) {
    lastPlayTime = now;
    hitSound.currentTime = 0;

    const volume = Math.min(collisionVelocity * 0.1, 1);
    hitSound.volume = volume;

    hitSound.play();
  }
};

const cubeTextureLoader = new THREE.CubeTextureLoader();

const environmentMapTexture = cubeTextureLoader.load([
  "/textures/environmentMaps/0/px.png",
  "/textures/environmentMaps/0/nx.png",
  "/textures/environmentMaps/0/py.png",
  "/textures/environmentMaps/0/ny.png",
  "/textures/environmentMaps/0/pz.png",
  "/textures/environmentMaps/0/nz.png",
]);

const world = new CANNON.World();
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.gravity.set(0, -9.82, 0);

gui
  .add({ gravity: -9.82 }, "gravity")
  .min(-20)
  .max(5)
  .step(0.0001)
  .name("Gravity")
  .onChange((value) => {
    world.gravity.set(0, value, 0);
  });

const defaultMaterial = new CANNON.Material("default");

const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.1,
    restitution: 0.5,
  }
);

world.addContactMaterial(defaultContactMaterial);

const floorShape = new CANNON.Plane();
const floorBody = new CANNON.Body();
floorBody.mass = 0;
floorBody.addShape(floorShape);
floorBody.material = defaultMaterial;
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
world.addBody(floorBody);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({
    color: "#777777",
    metalness: 0.3,
    roughness: 0.4,
    envMap: environmentMapTexture,
    envMapIntensity: 0.5,
  })
);
floor.receiveShadow = true;
floor.rotation.x = -Math.PI * 0.5;
scene.add(floor);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.camera.left = -7;
directionalLight.shadow.camera.top = 7;
directionalLight.shadow.camera.right = 7;
directionalLight.shadow.camera.bottom = -7;
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(-3, 3, 3);
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const objectsToUpdate = [];

const sphereGeometry = new THREE.SphereGeometry(1, 20, 20);
const sphereMaterial = new THREE.MeshStandardMaterial({
  metalness: 0.3,
  roughness: 0.4,
  envMap: environmentMapTexture,
});

const createSphere = (radius, position) => {
  const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
  mesh.scale.set(radius, radius, radius);
  mesh.castShadow = true;
  mesh.position.copy(position);
  scene.add(mesh);

  const shape = new CANNON.Sphere(radius);

  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 3, 0),
    shape,
    material: defaultMaterial,
  });
  body.position.copy(position);
  body.addEventListener("collide", playHitSound);
  world.addBody(body);

  objectsToUpdate.push({
    mesh,
    body,
  });
};

const createRandomSphere = () => {
  const randomSize = (Math.random() + 0.1) * 0.4;
  const randomX = (Math.random() - 0.5) * 3;
  const randomY = (Math.random() + 1) * 2;
  const randomZ = (Math.random() - 0.5) * 3;
  console.log({ randomSize }, { randomX }, { randomY }, { randomZ });
  createSphere(randomSize, {
    x: randomX,
    y: randomY,
    z: randomZ,
  });
};

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const boxMaterial = new THREE.MeshStandardMaterial({
  metalness: 0.3,
  roughness: 0.4,
  envMap: environmentMapTexture,
  envMapIntensity: 1,
});

const createBox = (size, position) => {
  const box = new THREE.Mesh(boxGeometry, boxMaterial);
  box.castShadow = true;
  box.scale.set(size.x, size.y, size.z);
  box.position.copy(position);
  scene.add(box);

  const shape = new CANNON.Box(
    new CANNON.Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5)
  );
  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 0, 0),
    shape,
    material: defaultMaterial,
  });
  body.position.copy(position);
  body.addEventListener("collide", playHitSound);
  world.addBody(body);
  objectsToUpdate.push({
    mesh: box,
    body,
  });
};

const createRandomBox = () => {
  const randomXScale = (Math.random() + 0.01) * 1.5;
  const randomYScale = (Math.random() + 0.01) * 1.5;
  const randomZScale = (Math.random() + 0.01) * 1.5;

  const randomXPos = (Math.random() - 0.5) * 3;
  const randomYPos = (Math.random() + 1) * 2;
  const randomZPos = (Math.random() - 0.5) * 3;

  console.log(
    { x: randomXScale, y: randomYScale, z: randomZScale },
    { x: randomXPos, y: randomYPos, z: randomZPos }
  );

  createBox(
    { x: randomXScale, y: randomYScale, z: randomZScale },
    { x: randomXPos, y: randomYPos, z: randomZPos }
  );
};

// createBox({ x: 1, y: 1, z: 1 }, { x: 2, y: 4, z: 1 });
createRandomBox();

const resetObj = () => {
  for (const object of objectsToUpdate) {
    object.body.removeEventListener("collide", playHitSound);
    world.removeBody(object.body);
    scene.remove(object.mesh);
  }
};

gui.add({ createRandomBox }, "createRandomBox").name("Create Box");
gui.add({ createRandomSphere }, "createRandomSphere").name("Create Sphere");
gui.add({ resetObj }, "resetObj").name("Reset Objects");

createSphere(0.5, { x: 0, y: 3, z: 0 });
createSphere(0.5, { x: 2, y: 3, z: 3 });

const clock = new THREE.Clock();
let oldElapsedTime = 0;

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - oldElapsedTime;
  oldElapsedTime = elapsedTime;

  world.step(1 / 60, deltaTime, 3);

  for (const object of objectsToUpdate) {
    object.mesh.position.copy(object.body.position);
    object.mesh.quaternion.copy(object.body.quaternion);
  }

  controls.update();

  renderer.render(scene, camera);

  window.requestAnimationFrame(tick);
};

tick();
