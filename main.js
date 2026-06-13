//
//
//       *****************************************************************************
//       **                                                                         **
//       **     All glory to the Creator YHWH and his Son, our King, Jesus Christ   **
//       **                                                                         **
//       *****************************************************************************
//
//
//
// this file: "Camera6DOF.js"
// GAME START: [X][Y][-Z] ... -z is "forward" 
//                                [Y]              [-Z] 
//                                **              **
//                                **            **
//                                **          **
//                                **        **
//                                **      **
//                                **    **
//                                **  **
//                                ****
//      ******************************************************[X]
//                              ****
//                            **  **
//                          **    **
//                        **      **
//                      **        **
//                    **          **
//                  **            **
//                **              **
////////////////////////////////////////////////////////////////////////////////////
// OPENGL 4X4 IDENTITY MATRIX
// | 1  0  0  0 |  ->  | m0 m4 m8  m12 |   // m0, m1, m2: First column, representing the x-axis direction vector.
// | 0  1  0  0 |  ->  | m1 m5 m9  m13 |   // m4, m5, m6: Second column, representing the y-axis direction vector.
// | 0  0  1  0 |  ->  | m2 m6 m10 m14 |   // m8, m9, m10: Third column, representing the z-axis direction vector.
// | 0  0  0  1 |  ->  | m3 m7 m11 m15 |   // m12, m13, m14: Translation components along the x, y, and z axes, respectively.
////////////////////////////////////////////////////////////////////////////////////
// OPENGL + RAYLIB "MATRIX" STRUCT
// | 1  0  0  10 |  ->  | m0  m4  m8  m12 |    // [12] = x-axis translation
// | 0  1  0  0  |  ->  | m1  m5  m9  m13 |    // [13] = y-axis translation
// | 0  0  1  0  |  ->  | m2  m6  m10 m14 |    // [14] = z-axis translation
// | 0  0  0  1  |  ->  | m3  m7  m11 m15 |    // [15] = always 1, required for matrix multiplication
////////////////////////////////////////////////////////////////////////////////////
// AXIS IN RELATION TO RAYLIB DEFAULT CAMERA POSITION
// [13][Y] = (+)up     (-)down
// [12][X] = (+)right  (-)left
// [14][Z] = (-)forward (+)back
////////////////////////////////////////////////////////////////////////////////////
// THREE.JS Matrix4 ELEMENT STORAGE (COLUMN MAJOR - SAME AS OPENGL)
// | 1  0  0  10 |  ->  | e0  e4  e8  e12 |
// | 0  1  0  0  |  ->  | e1  e5  e9  e13 |
// | 0  0  1  0  |  ->  | e2  e6  e10 e14 |
// | 0  0  0  1  |  ->  | e3  e7  e11 e15 |
//
// matrix.elements[12] = x position
// matrix.elements[13] = y position
// matrix.elements[14] = z position
//
// const e = mesh.matrix.elements;
// console.log(e[12], e[13], e[14]); // x, y, z world position
////////////////////////////////////////////////////////////////////////////////////
// THREE.JS WORLD AXIS CONVENTION
// Y+ = up
// X+ = right
// Z+ = toward camera / backward
// Z- = forward into the screen
//
// SAME HANDEDNESS + FORWARD DIRECTION AS OPENGL
// THREE.JS IS RIGHT-HANDED BY DEFAULT
////////////////////////////////////////////////////////////////////////////////////
        /*
        Workflow:
        |
        |
        |--> (TEXTURE) Build "Material" 
        |    This sends the PNG to the GPU memory immediately
        |    1) const albedoTex = textureLoader.load('../assets/sgs_01_texture.png');
        |    2) const normalTex = textureLoader.load('../assets/sgs_01_normals.png');
        |    3) const metalTex  = textureLoader.load('../assets/sgs_01_metal.png');
        |    4) const roughTex  = textureLoader.load('../assets/sgs_01_roughness.png');
        |
        |
        |--> (MESH) Second load "obj" with OBJLoader 
        |     This will default to gray if no "Material" is loaded
        |     1) const loader = new OBJLoader();
        |        loader.load('../assets/sgs_01.obj', (obj) => { this.shipModel = obj; this.origin.add(this.shipModel);}
        |
        |
        |--> (MESH + TEXTURE) Combine material and obj
        |     1) force model obj to use PBR material
        |
        |        loader.load('../assets/sgs_01.obj', (obj) => {
        |        // The "Traverse" logic:
        |        // OBJs are 'Groups'. We visit every 'Mesh' inside that group.
        |            obj.traverse((child) => {
        |                if (child.isMesh) {
        |                    // Overwrite the gray Blender material with our PBR skin
        |                    child.material = shipMaterial;
        |                }
        |            });
        |
        |            this.shipModel = obj;
        |            this.origin.add(this.shipModel);
        |
        |            this.mesh.visible = false; // Hide debug box
        |            this.shapeLines.visible = false;
        |        });
        
        In short: 
        * The Mesh is the solid thing I can "touch" (the 3D shape). 
        * The Texture is the colorful picture I "wrap" around it to make it look real.
        * The .obj file IS the Mesh. It’s just a long list of coordinates (X, Y, Z) that tell the computer where all the corners and edges of your ship are.
        * The .png file IS the Texture. It’s the 2D image that gets "shrink-wrapped" onto that shape.

        Implementation Logic:
        1. The Traverse Requirement: I'm using .traverse() because the OBJLoader returns a THREE.Group (a container) rather than a single mesh. Since a group doesn't have a material property, I have to iterate through the model’s
            hierarchy and manually inject my material into every individual Mesh child found inside.
        2. Metalness Multiplier (1.0): I’m setting the metalness property to 1.0 to act as a full-strength multiplier for my metalness map. If I leave this at the default (0.0), the shader will multiply the map’s values by zero,
            making the ship look like flat plastic regardless of the texture. Setting it to 1.0 tells the GPU to follow the map's data exactly.
        3. Lighting Requirements: Currently, main.js only uses an AmbientLight. For this PBR workflow—specifically the normal maps—to work, I’ll need to add a DirectionalLight or a PointLight. Without a light source that has a
            specific direction, the surface bumps won't cast micro-shadows, and the ship will look flat despite having high-res textures.

        Asset Manifest (Required in /assets):
        * sgs_01_texture.png: Albedo/Diffuse (The raw paint and base colors).
        * sgs_01_normals.png: Normal Map (The surface detail like bolts and panel lines).
        * sgs_01_metal.png: Metalness Map (Defining what parts are raw metal vs. paint).
        * sgs_01_roughness.png: Roughness Map (Defining what parts are shiny vs. matte).

        */

        /************************
        **                     **
        ** Texture   +   Model ** 
        ** Material      Mesh  ** // <--- if using ".gltf" I found skinning the model diffuclt with gltf
        **                     ** // <--- this did not work well with the blender export
        ************************/
        //  const textureLoader = new THREE.TextureLoader();
        
        //  // 1. Load your PNG from the assets folder
        //  const shipPaint = textureLoader.load('../assets/ImageForBlackReflective.png');
        
        //  // 2. Ensure colors are vibrant (sRGB) and not washed out
        //  shipPaint.colorSpace = THREE.SRGBColorSpace; 
        
        //  // 3. GLTF models use a different coordinate system for textures than OBJs
        // shipPaint.flipY = false; 

        //     const manualMaterial = new THREE.MeshStandardMaterial({
        //     map: shipPaint,     // Use your painted PNG
        //     color: 0xffffff,    // Neutral white (Let the texture colors shine)
        //     metalness: 0.5,     // 100% Metallic
        //     roughness: 0.5      // Mirror-like finish
        // });

        /*
            THRUSTER MAP from "six_dof_object.c":
                |[01]|[02]|[03]|[04]|[05]|[06]|[07]|[08]|[09]|[10]|[11]|[12]|[13]|[14]|[15]|[16]|[17]|[18]|[19]|
            ----------------------------------------------------------------------------------------------------
            [A] |    |    |    | $$ |    |    |    | $$ | $$ |    |    |    | $$ |    |    |    |    |    |    |
            ----------------------------------------------------------------------------------------------------
            [B] |    |    | ++ | $$ |    | ++ | $$ | $$ | $$ | $$ | ++ |    | $$ | ++ |    |    |    |    |    |
            ----------------------------------------------------------------------------------------------------
            [C] |    |    |    |    |    |    | $$ | $$ | $$ | $$ |    |    |    |    |    |    |    |    |    |
            ----------------------------------------------------------------------------------------------------
            [D] |    |    |    |    |    |    | $$ | $$ | $$ | $$ |    |    |    |    |    |    |    |    |    |
            ----------------------------------------------------------------------------------------------------
            [E] |    |    | ++ | $$ |    | ++ | $$ | $$ | $$ | $$ | ++ |    | $$ | ++ |    |    |    |    |    |
            ----------------------------------------------------------------------------------------------------
            [F] |    |    |    | $$ |    |    |    | $$ | $$ |    |    |    | $$ |    |    |    |    |    |    |
            ----------------------------------------------------------------------------------------------------
            + = MINOR THRUSTER
            $ = MAJOR THRUSTER
        */

        // SCENE (The Global Container)
        // │
        // ├── worldGroup [MOVES ↔️] (The "Universe" container)
        // │   │   // Everything inside here slides in reverse to your inputs
        // │   ├── theGrid
        // │   ├── testSurfaceObj (The Floor)
        // │   └── [Planets / Stars / Stations] (Future objects)
        // │
        // └── player.origin [ROTATES 🔄] (Fixed at 0, 0, 0)
        //     │   // This is YOUR ship. It never leaves 0,0,0. It only spins.
        //     ├── mesh (Debug Box)
        //     ├── shapeLines (Debug Edges)
        //     ├── shipModel (The Actual OBJ)
        //     └── camera [FOLLOWS 🎥] (Slave to player movement)
        // this file: "main.js"

/*******************
**                ** 
** INITILIZATIONS **
**                **
*******************/
import * as THREE from 'three/webgpu';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Player } from './player.js';
import { InstancedTrails } from './_weapons_vxf/instancedTrails.js';
import Stats from 'three/addons/libs/stats.module.js'; // <-- no braces needed becuase its a default export
const scene = new THREE.Scene();

// window resolution
let RENDER_WIDTH = window.innerWidth;
let RENDER_HEIGHT = window.innerHeight;

// statistics
const stats = new Stats();
document.body.appendChild(stats.dom);

// camera
const camera = new THREE.PerspectiveCamera( 50, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000  );
const renderer = new THREE.WebGPURenderer({ antialias: true });

// opengl render buffer is fixed size + handle html dom margins
renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
document.body.style.margin = "0";
document.body.style.overflow = "auto";
renderer.domElement.style.width = RENDER_WIDTH;
renderer.domElement.style.height = RENDER_HEIGHT;
renderer.setPixelRatio(1); // Force rendering to use a 1:1 pixel scale so graphics math behaves consistently across different monitors and DPI settings
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

// event listner incase the above resolutions + window size changes due to user altering the window sizes
window.addEventListener('resize', () => {

  // update local width/height variables
  RENDER_WIDTH = window.innerWidth;
  RENDER_HEIGHT = window.innerHeight;

  // update the camera aspect ratio
  camera.aspect = RENDER_WIDTH / RENDER_HEIGHT;
  camera.updateProjectionMatrix(); // <-- critical: Forces the camera to recalculate its math

  // update the OpenGL Render Buffer
  // this resizes the actual "drawing surface"
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);

  // update the Canvas CSS (The visual container)
  renderer.domElement.style.width = RENDER_WIDTH + 'px';
  renderer.domElement.style.height = RENDER_HEIGHT + 'px';

});



/*******************
**                **
** TIMING         **
**                **
*******************/
let lastTime = 0;
let deltaTime = 0;



/*******************
**                ** 
** GAMEPAD        **
**                **
*******************/
function getGamepad() 
{
  const gamepads = navigator.getGamepads();
  return gamepads[0];
}



/*******************
**                ** 
** WORLD SPACE    **
** WORLD GROUPS   **
**                **
*******************/
const worldGroup = new THREE.Group();
scene.add(worldGroup);

// axis lines
// scene
//  ├── groupMyLines (HAS transform)
//  │    ├── lineX
//  │    ├── lineY
//  │    └── lineZ
//  └── cube
const positiveX = [
  new THREE.Vector3(0,0,0), // start
  new THREE.Vector3(1,0,0)  // end
];
const positiveY = [
  new THREE.Vector3(0,0,0), // start
  new THREE.Vector3(0,1,0)  // end
]; 
const positiveZ = [
  new THREE.Vector3(0,0,0), // start
  new THREE.Vector3(0,0,1)  // end
];  
const worldX = new THREE.BufferGeometry().setFromPoints(positiveX);
const worldY = new THREE.BufferGeometry().setFromPoints(positiveY);
const worldZ = new THREE.BufferGeometry().setFromPoints(positiveZ);

const lineMaterialX = new THREE.LineBasicMaterial({ color: 0xff0000 });
const lineMaterialY = new THREE.LineBasicMaterial({ color: 0x00ff00 });
const lineMaterialZ = new THREE.LineBasicMaterial({ color: 0x0000ff });

const lineX = new THREE.Line(worldX, lineMaterialX);
const lineY = new THREE.Line(worldY, lineMaterialY);
const lineZ = new THREE.Line(worldZ, lineMaterialZ);

const groupMyLines = new THREE.Group();
groupMyLines.add(lineX);
groupMyLines.add(lineY);
groupMyLines.add(lineZ);
//scene.add(groupMyLines);
worldGroup.add(groupMyLines);


// shapes and wires
// Object3D
//  └── Mesh
//       ├── Geometry
//       └── Material
// const myCube = new THREE.BoxGeometry( 1, 1, 1 );
// const myCone = new THREE.ConeGeometry(1, 2, 13);
// const mySphere = new THREE.SphereGeometry(1,13,13);
// const material = new THREE.MeshBasicMaterial({ // A mesh is an object that takes a geometry, and applies a material to it
//       color: 0x00ff00, wireframe: true
// }); 
// const myObject = new THREE.Mesh(myCone, material); // The object that combines the shape and appearance and inherits transform behavior from Object3D
// // scene.add(myObject);

// test surfaces and environmnet
const testSurface = new THREE.PlaneGeometry(100,100);
// const testSurfaceMat = new THREE.MeshStandardMaterial({ // requires a light source
//       color: 0x808080,      // Gray as a hex value
//       side: THREE.DoubleSide,
//       roughness: 0.5,
//       metalness: 0.5
// });
const testSurfaceMat = new THREE.MeshBasicMaterial({
      color: 0x2b2b2b,      // Gray as a hex value
      side: THREE.DoubleSide,
});
const testSurfaceObj = new THREE.Mesh(testSurface, testSurfaceMat);
//scene.add(testSurfaceObj);
worldGroup.add(testSurfaceObj);


// move the floor down and rotate 90 degrees to be flat
testSurfaceObj.position.y = -2;
testSurfaceObj.rotation.x = -Math.PI / 2;

// test grid matching floor position
const theGrid = new THREE.GridHelper(100, 20, 0x40ecf0, 0x40ecf0);
//scene.add(theGrid);
worldGroup.add(theGrid);
theGrid.position.y = -2;


/*****************
**              **
** AMMUNITIONS  **
**              **
*****************/
let activeMunitions = [];

/*****************
**              **
** VFX          **
**              **
*****************/
let trails = [];

/**************************
**                        **
** INSTANCED MESH SECTION **
**                        **
***************************/
const instancedTrails = new InstancedTrails(worldGroup);

/*********************
**                  **
** PLAYER + CAMERA  **
**                  **
*********************/
// slaved to 6dof obj --> ALL objects in javascript are passed by reference
const player = new Player(scene, worldGroup, activeMunitions, trails, instancedTrails); // 6dof custom class
player.mountCamera(camera);

/*******************
**                **
** LIGHTING       **
**                **
*******************/
// SCENE (The Global Container)
// │
// ├── worldGroup [MOVES ↔️] (The "Universe" container)
// │   │   // Everything inside here slides in reverse to your inputs
// │   ├── theGrid
// │   ├── testSurfaceObj (The Floor)
// │   ├── groupMyLines (Universe Center Markers)
// │   └── [Planets / Stars / Stations] (Future objects)
// │
// ├── player.origin [ROTATES 🔄] (Fixed at 0, 0, 0)
// │   │   // This is YOUR ship. It never leaves 0,0,0. It only spins.
// │   ├── shipModel (The Mesh)
// │   └── camera [FOLLOWS 🎥] (Rotates with the ship)
// │
// └── shipLights [STATIC 📍] (Fixed at 0, 0, 0 | No Rotation)
//      │   // These live in the Scene. They stay at 0,0,0 but don't spin.
//      ├── shipLight_01
//      ├── shipLight_02
//      └── shipLight_03
// Ship specific lighting (eventually move this to ship obj Camera6DOF.js)
// -10 z seems to be about right bove center fusalage

// ship light 01
const shipLight_01 = new THREE.DirectionalLight(0xffffff, 50.0); // debug red
shipLight_01.position.set(0, 5, -3); // Coming from above and to the side
scene.add(shipLight_01);

// ship light 02
const shipLight_02 = new THREE.DirectionalLight(0xffffff, 25.0); // debug green
shipLight_02.position.set(5, 0, 5); // Coming from above and to the side
scene.add(shipLight_02);

// ship light 03
const shipLight_03 = new THREE.DirectionalLight(0xffffff, 25.0); // debug blue
shipLight_03.position.set(-5, 0, 5); // Coming from above and to the side
scene.add(shipLight_03);

// mesh + mat debugs for lights:
const lightSphereGeo    = new THREE.SphereGeometry(0.5, 8, 8);
const lightSphereMat_01 = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const lightSphereMat_02 = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const lightSphereMat_03 = new THREE.MeshBasicMaterial({ color: 0x0000ff });

// visual for Ship Light 01
const shipLight_01_Mesh = new THREE.Mesh(lightSphereGeo, lightSphereMat_01);
shipLight_01_Mesh.position.copy(shipLight_01.position);
//scene.add(shipLight_01_Mesh);

// visual for Ship Light 02
const shipLight_02_Mesh = new THREE.Mesh(lightSphereGeo, lightSphereMat_02);
shipLight_02_Mesh.position.copy(shipLight_02.position);
//scene.add(shipLight_02_Mesh);

// visual for Ship Light 03
const shipLight_03_Mesh = new THREE.Mesh(lightSphereGeo, lightSphereMat_03);
shipLight_03_Mesh.position.copy(shipLight_03.position);
//scene.add(shipLight_03_Mesh);


/*******************
**                ** 
** MAIN GAME LOOP **
**                **
*******************/
function animate( time ) 
{

  // timing... "time" is provided by THREE.js + Canvas's "requestAnimationFrame"
  // delta time iteration
  if (lastTime > 0) {
    deltaTime = (time - lastTime) / 1000; // time in milli since last frame
  }
  lastTime = time;
  
  // delta time 
  const dt = Math.min(deltaTime, 0.1); // The browser is sensitive to postion and size change, this gaurds against the pause
  
  // windows xbox controller
  const gp = getGamepad();

  /********************
  **                 **
  ** Player          ** (Camera.6DOF.js)
  **                 **
  ********************/
  player.update(gp, dt); // returns NULL

  // stats
  stats.update();

  // here i am moving the world not the player
  // .negate() turns (0, 0, 10) into (0, 0, -10)
   worldGroup.position.copy(player.position).negate();

  /********************
  **                 **
  ** Ammunition      **
  **                 **
  ********************/
  if (activeMunitions.length > 0)
  {
    activeMunitions.forEach(element => {
      element.update(dt);
    });
    // TO THIS (Modify the array in place)
    for (let i = activeMunitions.length - 1; i >= 0; i--) {
      if (!activeMunitions[i].alive) {
          activeMunitions.splice(i, 1);
      }
    }
  }

  /********************
  **                 **
  ** Old Trails      **
  **                 **
  ********************/
  if(trails.length > 0)
  {
    trails.forEach(element => {
      element.update(dt, worldGroup);
    });
    for (let i = trails.length - 1; i >= 0; i--){
      if (!trails[i].alive) {
        trails.splice(i, 1);
      }
    }
  }

  // debug how big can trails get?
  //console.log(trails.length);
  //console.clear();

  /********************
  **                 **
  ** New Instance    **
  ** Trails          **
  **                 **
  ********************/
  instancedTrails.update(dt, camera);



  // renderer
  renderer.render( scene, camera );

}

// main game loop call
renderer.setAnimationLoop(animate);

// diagnostic: confirm WebGPU is active
renderer.init().then(() => {
    const isWebGPU = renderer.isWebGPURenderer;
    console.log("Is WebGPU Active:", isWebGPU);
    console.log("Renderer Type:", renderer.constructor.name);
});




















