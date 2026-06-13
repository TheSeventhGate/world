// player.js
import * as THREE from 'three/webgpu';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Laser } from './_weapons/ammunition.js';

export class Player 
{

    /*******************
    **                **
    ** Construct      **
    **                **
    *******************/
    constructor(scene, worldGroup, activeMunitions, trails, instancedTrails)
    {

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

        // timing
        this.dt = 0.0;

        // fire rate timer
        this.fireRateTimer = 0.0;
        this.fireRate = 0.1;
        this.munitions = activeMunitions;
        this.trail = trails;
        this.instancedTrails = instancedTrails;

        // origin root in relation to world space
        this.world = worldGroup;
        this.origin = new THREE.Object3D();
        scene.add(this.origin);

        // positioning and rotations in relation to origin
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        this.rightShotPosition    = new THREE.Vector3(); // scratch vector for shooting logic
        this.leftShotPosition     = new THREE.Vector3(); // scratch vector for shooting logic
        this.centerShotPosition   = new THREE.Vector3(); // scratch vector for shooting logic
        this.selectedShotPosition = new THREE.Vector3();
        this.rightBool = true;
        this.centerBool = false;

        // visual model in relation to root above (can be considered local space)
        // all edges and lines and mat below is for debug only
        this.shape      = new THREE.BoxGeometry( 1, 1, 1 );
        this.shapeEdges = new THREE.EdgesGeometry(this.shape);
        this.shapeLines = new THREE.LineSegments(this.shapeEdges);
        this.mat        = new THREE.MeshBasicMaterial({color: 0Xdb341f, wireframe: false, transparent: true, opacity: 0.5});
        this.mesh       = new THREE.Mesh(this.shape, this.mat);

        // attach the mesh as a child of the origin
        this.origin.add(this.mesh);
        this.origin.add(this.shapeLines)

        /***********
        **        **
        **Texture **
        **Material**
        **        **
        ***********/
        const textureLoader = new THREE.TextureLoader();

        const shipPaint = textureLoader.load('../assets/ImageForBlackReflective.png');
        shipPaint.colorSpace = THREE.SRGBColorSpace;

        const shipMaterial = new THREE.MeshStandardMaterial({
            map: shipPaint,
            color: 0xffffff,    // Keep white so the texture colors are accurate
            metalness: 0.8,     // High metalness for that "reflective" look
            roughness: 0.2      // Low roughness for a glossy/shiny finish
        });

        /***********
        **        **
        ** Model  **
        ** Mesh   **
        **        **
        ***********/
        const loader = new OBJLoader();
        loader.load('../assets/sgs_02.obj', (obj) => {
            
            // traverse the group to find the mesh pieces
            obj.traverse((child) => {
                if (child.isMesh) {
                    // Apply our custom material to every part of the OBJ
                    child.material = shipMaterial;
    
                    // Enable shadows for better depth
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
    
            // raw model obj from blender export
            this.shipModel = obj;
            this.origin.add(this.shipModel);
    
            // hide the debug wireframe box
            this.mesh.visible = false;
            this.shapeLines.visible = false;
        });


        /***********
        **        **
        **Thruster**
        **Animates**
        **        **
        ***********/
        // material used by all thrusters
        // this.thrusterMaterial = new THREE.MeshBasicMaterial({
        //     color: 0x00ffff,
        //     transparent: true,
        //     opacity: 0.8,
        //     side: THREE.DoubleSide
        // });

        // inputs controller (windows xbox controller)
        this.strafeInpt = 0.0;
        this.accelInput = 0.0;
        this.yawInput   = 0.0;
        this.pitchInput = 0.0;
        this.rollInput  = 0.0;
        this.rollDelta  = 0.0;
        this.deadZone   = 0.1;
        this.leftTriggr = { pressed: false, value: 0 }; 
        this.rghtTriggr = { pressed: false, value: 0 }; 
        this.leftBumper = { pressed: false, value: 0 }; 
        this.rghtBumper = { pressed: false, value: 0 };
        this.buttonA    = { pressed: false, value: 0 };
        this.buttonX    = { pressed: false, value: 0 };

        // inputs mouse and keyboard
        // ....

        // vectors + flight control characteristics
        this.strafeVector    = new THREE.Vector3(1, 0, 0); // x
        this.forwardVector   = new THREE.Vector3(0, 0, 1); // z
        this.rightAxis       = new THREE.Vector3(1, 0, 0); // x
        this.upAxis          = new THREE.Vector3(0, 1, 0); // y
        this.fwrdAxis        = new THREE.Vector3(0, 0, 1); // z
        this.pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -this.pitchInput * 0.05); // x
        this.yawQuaternion   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), -this.yawInput   * 0.05); // y  
        this.rollQuaternion  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),  this.rollDelta  * 0.05); // z
        
        // velocities + thrusts + speeds
        this.accelSpeed    = 6.0;      // z ... translate ... -z forward
        this.strafeSpeed   = 10.0;     // x ... translate
        this.pitchSpeed    = 0.8;      // x ... rotate
        this.yawSpeed      = 2.0;      // y ... rotate
        this.rollSpeed     = 1.8;      // z ... rotate
        this.thrust        = 0.0;     
        this.strafeThrust  = 0.0;
        this.yawVelocity   = 0.0;
        this.pitchVelocity = 0.0;
        this.rollVelocity  = 0.0;

        // stabilizers + auto levellers
        this.dampAccelSpeed    = 0.01; // z ... translate ... -z forward
        this.dampStrafeSpeed   = 0.1;  // x ... translate
        this.damPitchSpeed     = 0.1;  // x ... rotate
        this.dampYawSpeed      = 0.1;  // y ... rotate
        this.dampRollSpeed     = 0.1;  // z ... rotate

        // camera state
        this.firstPerson = false;
        this.buttonXPrev = false;

        // camera
        this.camera           = null;
        this.timeElapsed      = 0.0;
        this.cameraFrequency  = 2.2;  
        this.cameraAmplitude  = 0.002;
        this.cameraBasePos    = 0.0;

        // camera trailing /elastic behavior
        // this.lookTarget    = new THREE.Vector3(0, 1, -35);// <-- breaks look at if i do it this way
        this.vTargetPos  = new THREE.Vector3();
        this.vOffset     = new THREE.Vector3();
        this.vLookTarget = new THREE.Vector3();
        this.vWorldUp    = new THREE.Vector3();
        this.camWeldPoint     = new THREE.Vector3(0, 4, 12); // Ideal chase position
        this.camRadius        = 2.5;                         // Max displacement sphere
        this.camLerpSpeed     = 3.0;                         // How fast it returns to target
        this.camInertia       = 0.5;                         // Sensitivity to movement

    }

    /*******************
    **                **
    ** Slave Camera   **
    **                **
    *******************/
    mountCamera(camera)
    {   
        // camera reference (by default js passes everything by reference)
        this.camera = camera;

        if(this.firstPerson)
        {
            // [1st] person view: (no position set just defaults to obj origin)
            this.origin.add(this.camera);
        } 
        else 
        {
            // [3rd] person view:
            this.origin.add(this.camera);
            this.camera.position.copy(this.camWeldPoint); // Start at the weld point
        }


    }

    /*******************
    **                **
    ** Update Camera  **
    **                **
    *******************/
    updateCamera()
    {
        if (!this.camera) return;

        if (this.buttonX.pressed && !this.buttonXPrev)
        {
            this.firstPerson = !this.firstPerson;
        }
        this.buttonXPrev = this.buttonX.pressed;

        if (this.shipModel)
        {   
            this.shipModel.visible = !this.firstPerson;
        }

        if (this.firstPerson)
        {
            // no camera bob implement yet for first person
            this.camera.position.set(0, 0, 0); 
        }
        else
        {
            // displacement variables for camera leaning effect
            let lagX = -this.strafeThrust * 0.4 - this.yawVelocity * 1.5;
            let lagY = -this.pitchVelocity * 1.5;
            let lagZ = -this.thrust * 0.6;
   
             // combine welded cam point + above lags into a "target" position
            this.vTargetPos.set(
                this.camWeldPoint.x + lagX,
                this.camWeldPoint.y - lagY,
                this.camWeldPoint.z + lagZ
            );
   
             // lerp the current position towards targetPos
            this.camera.position.lerp(this.vTargetPos, this.camLerpSpeed * this.dt);
   
            // bounding sphere: clamp the camera within camRadius of the Weld Point
            this.vOffset.subVectors(this.camera.position, this.camWeldPoint);
            if (this.vOffset.length() > this.camRadius) 
            {
                this.vOffset.setLength(this.camRadius);
                this.camera.position.addVectors(this.camWeldPoint, this.vOffset);
            }
   
            // look slightly ahead or at the ship
            // convert a local point in front of the ship to world space for the camera to look at
            this.vLookTarget.set(0, 1, -35); 
            this.origin.localToWorld(this.vLookTarget);
   
            // to make the camera roll with the ship, we must tell it what "Up" is 
            // in world space. Otherwise, .lookAt() defaults to world-up (0,1,0)
            this.vWorldUp.set(0, 1, 0);
            this.vWorldUp.applyQuaternion(this.origin.quaternion);
            this.camera.up.copy(this.vWorldUp);
   
            // i look at the correct target
            this.camera.lookAt(this.vLookTarget);
   
            // sinusoidal action on y
            this.camera.position.y += Math.sin(this.timeElapsed * this.cameraFrequency) * this.cameraAmplitude;

        }
    }

    /*******************
    **                **
    ** Process Inputs **
    **                **
    *******************/
    processInputs(gp)
    {

        // note "gp" will always return null at first load of webpage. must gaurd with "if (!gp) return;"
        if (!gp) return;               

        // axes
        this.strafeInpt = gp.axes[0];  // (strafe)
        this.accelInput = gp.axes[1];  // (foward/back)
        this.yawInput   = gp.axes[2];  // (yaw)
        this.pitchInput = gp.axes[3];  // (pitch) 

        // buttons
        this.leftTriggr = gp.buttons[6]; // <--- correct number?
        this.rghtTriggr = gp.buttons[7];
        this.leftBumper = gp.buttons[4];
        this.rghtBumper = gp.buttons[5];
        this.buttonA    = gp.buttons[0]; // (A Button)
        this.buttonX    = gp.buttons[2]; // (X Button)

    }

    /*******************
    **                **
    ** Translate      **
    **                **
    *******************/
    translate()
    {

        /***********
        **        **
        **  Accel **
        **        **
        ***********/
        this.thrust = THREE.MathUtils.clamp(this.thrust, -15.0, 3.0); // "-" = forward
        if (Math.abs(this.accelInput) > this.deadZone)
        {
            this.thrust += this.accelInput * this.accelSpeed * this.dt;
        } 
        else 
        {
            this.thrust *= 0.99; // loss of % each frame
            if (Math.abs(this.thrust) < 0.03 )
            {
                this.thrust = 0; // technicly a cast, but worth it for true 0...
            } 
        }

        // apply accelleration
        this.forwardVector.set(0,0,1);  // <-- "reset"
        this.forwardVector.applyQuaternion(this.rotation);
        this.position.add(this.forwardVector.multiplyScalar(this.thrust * this.dt));
        //console.log(this.thrust + " " + this.accelInput)

        /***********
        **        **
        ** Strafe **
        **        **
        ***********/
        this.strafeThrust = THREE.MathUtils.clamp(this.strafeThrust, -20.0, 20.0);
        if (Math.abs(this.strafeInpt) > this.deadZone)
        {
            this.strafeThrust += this.strafeInpt * this.strafeSpeed * this.dt;
        }
        else
        {
            this.strafeThrust *= 0.99;
            if (Math.abs(this.strafeThrust) < 0.03)
            {
                this.strafeThrust = 0;
            }
        }

        // apply strafe
        this.strafeVector.set(1,0,0);
        this.strafeVector.applyQuaternion(this.rotation);
        this.position.add(this.strafeVector.multiplyScalar(this.strafeThrust * this.dt));
        //console.log(this.strafeThrust + " " + this.strafeInpt);

    }

    /*******************
    **                **
    ** Rotate         **
    **                **
    *******************/
    rotate()
    {

        /***********
        **        **
        **  YAW   **
        **        **
        ***********/
        this.yawVelocity = THREE.MathUtils.clamp(this.yawVelocity, -100.0, 100.0);
        if (Math.abs(this.yawInput) > this.deadZone)
        {
            this.yawVelocity += this.yawInput * this.yawSpeed * this.dt;
        }
        else
        {
            this.yawVelocity *= 0.98;
            if (Math.abs(this.yawVelocity) < 0.02)
            {
                this.yawVelocity = 0;
            }
        }

        // apply yaw
        this.yawQuaternion.setFromAxisAngle(this.upAxis, -this.yawVelocity * this.dt);
        this.rotation.multiply(this.yawQuaternion); // local see A * B order of this quaternion in constructor // premultiply would be B * A
        this.rotation.normalize(); 

        /***********
        **        **
        **  PITCH **
        **        **
        ***********/
        this.pitchVelocity = THREE.MathUtils.clamp(this.pitchVelocity, -1.0, 1.0);
        if (Math.abs(this.pitchInput) > this.deadZone)
        {
            this.pitchVelocity += this.pitchInput * this.pitchSpeed * this.dt;
        }
        else
        {
            this.pitchVelocity *= 0.99;
            if (Math.abs(this.pitchVelocity) < 0.02)
            {
                this.pitchVelocity = 0;
            }
        }

        // apply pitch
        this.pitchQuaternion.setFromAxisAngle(this.rightAxis, -this.pitchVelocity * this.dt);
        this.rotation.multiply(this.pitchQuaternion); // local see A * B order of this quaternion in constructor // premultiply would be B * A
        this.rotation.normalize(); 

        /***********
        **        **
        **  ROLL  **
        **        **
        ***********/
        this.rollVelocity = THREE.MathUtils.clamp(this.rollVelocity, -5.0, 5.0);
   
        // calculate Roll Acceleration
        if (this.leftBumper.pressed) 
        {
            this.rollVelocity += 1.0 * this.rollSpeed * this.dt;
        } 
        else if (this.rghtBumper.pressed) 
        {
            this.rollVelocity -= 1.0 * this.rollSpeed * this.dt;
        } 
        else 
        {
            // ONLY damp if neither bumper is pressed
            this.rollVelocity *= 0.98;
            if (Math.abs(this.rollVelocity) < 0.02) this.rollVelocity = 0;
        }

        // apply Roll (The finalized velocity)
        this.rollQuaternion.setFromAxisAngle(this.fwrdAxis, this.rollVelocity * this.dt);
        this.rotation.multiply(this.rollQuaternion);
        this.rotation.normalize();

    }

    /*******************
    **                **
    ** DRAW           ** (player.update)
    **                **
    *******************/
    update(gp, dt) // gp = gamepad ... dt = deltatime
    {

        // increment time at the very start so the math changes
        this.dt = dt;
        this.timeElapsed += dt;
        this.fireRateTimer += dt;

        // call members and apply
        this.processInputs(gp);

        /*******************
        **                **
        ** WHAT TO SHOOT  **
        **                **
        *******************/
        if (this.fireRateTimer > this.fireRate && this.rghtTriggr.pressed)
        {
            this.fireRateTimer = 0;

                // calculate start position ( to the right in LOCAL space)
                // then rotate that offset to match ship, then add ship position
                this.rightShotPosition.set(2.5, 0, 0).applyQuaternion(this.rotation).add(this.position);
                this.leftShotPosition.set(-2.5, 0, 0).applyQuaternion(this.rotation).add(this.position);
                this.centerShotPosition.set(0, 0, 0).applyQuaternion(this.rotation).add(this.position);  
                this.selectedShotPosition.set(0, 0, 0).applyQuaternion(this.rotation).add(this.position); 

                if (this.centerShotPosition)
                {
                    if (this.rightBool)
                    {
                        this.selectedShotPosition.copy(this.rightShotPosition);
                    } 
                    else
                    {
                        this.selectedShotPosition.copy(this.leftShotPosition);
                    }
                } 
                else 
                {
                    this.selectedShotPosition.copy(this.centerShotPosition);
                }


                /*******************
                **                **
                ** SHOOTING       **
                **                **
                *******************/
               // player --> laser --> trails
                const shot = new Laser(this.world, this.instancedTrails);
                shot.fire  (
                    this.selectedShotPosition,
                    this.rotation
                );
                this.munitions.push(shot);

                this.rightBool = this.rightBool ? false : true;

        }

        // call members and apply
        this.translate(); 
        this.rotate();
        this.origin.quaternion.copy(this.rotation); // <-- world space implementation

        // camera follows player
        this.updateCamera();

    }

    /*******************
    **                **
    ** Destruct       **
    **                **
    *******************/
    destroy()
    {
        // remove from scene, free references
        this.myPosition = null;
        this.myRotation = null;
    }

};