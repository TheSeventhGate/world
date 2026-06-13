// ammunition.js
import * as THREE from 'three/webgpu';
import { LaserTrail } from '../_weapons_vxf/trails.js';

/********************
**                 **
** Ammunition Type **
**                 **
********************/
// Laser shape, color, size
//const laserGeometry = new THREE.CapsuleGeometry( 0.3, 2, 2, 8 );
const laserGeometry = new THREE.BoxGeometry( 1.0, 1.0);
const laserMaterial = new THREE.MeshBasicMaterial( {color: 0xffe6e6} );
//laserGeometry.rotateX(Math.PI / 2); 
export class Laser 
{
    // constructor(worldGroup, trails) // <-- old spawn (may still be valid for other effect tests later)
    constructor(worldGroup, instancedTrails)
    {
        // timing
        this.dt = 0.0;

        // attributes
        this.mesh = new THREE.Mesh(laserGeometry, laserMaterial);
        this.world = worldGroup;
        // this.trail = trails; // <-- old spawn (may still be valid for other effect tests later)
        this.instancedTrails = instancedTrails;
        this.myPosition = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.forward = new THREE.Vector3( 0, 0, -1 );
        this.ammunitionSpeed = 800; //800
        this.alive = false;
        this.lifespan = 3.0; // seconds before self-destruct
        this.age = 0;

        // arguments to pass to trail
        this.rotation = new THREE.Quaternion();
    }

    fire(startPos, rotation)
    {
        // initial state when fired
        this.alive = true;
        this.age = 0;

        // initial state position and vector
        this.mesh.position.copy(startPos);
        this.mesh.quaternion.copy(rotation);
        this.rotation.copy(rotation);

        // base forward direction
        const dir = this.forward.clone().applyQuaternion(rotation);

        // 🔥 shotgun spread (small random cone)
        const spread = 0.05; // tweak: 0.005 = tight laser, 0.05 = wild shotgun

        dir.x += THREE.MathUtils.randFloatSpread(spread);
        dir.y += THREE.MathUtils.randFloatSpread(spread);
        dir.z += THREE.MathUtils.randFloatSpread(spread);

        dir.normalize();

        // initial speed
        this.velocity.copy(dir).multiplyScalar(this.ammunitionSpeed);

        // make the laser visible
        this.world.add(this.mesh);
    }
    
    /*******************
    **                **
    ** DRAW           **
    **                **
    *******************/
    update(dt)
    {
        // if dead return
        if(!this.alive) return;

        // timing
        this.dt = dt; 

        // life span
        this.age += dt;
        if (this.age >= this.lifespan)
        {
            this.destroy();
            return;
        }

        // increment my current position in the universe space/worldpace/worldgroup
        this.mesh.position.addScaledVector(this.velocity, this.dt);
        this.myPosition.copy(this.mesh.position);


        /*******************
        **                **
        ** OLD TRAILS     **
        ** SYSTEM SPAWN   **
        *******************/
        // // i can controll how many trail planes are created by tuning a few factors
        // // one of the most important factors is how old is this laser and should i
        // // still continue to trail even though this laser is still alive
        // if (this.age < this.lifespan / 4) // <-- halflife
        // {  
        //     const myTrail = new LaserTrail(this.world);
        //     myTrail.start(
        //         this.myPosition,
        //         this.rotation
        //     );
        //     this.trail.push(myTrail);
        //     //   (this.lifespan / 1) = i noticed if i spam lasers i can reach an upper limit of 4000+ objs if i dont use halflife
        //     //   (this.lifespan / 2) = 2000+ upper limit
        //     //   (this.lifespan / 3) = 1600+ upper limit
        //     //   (this.lifespan / 4) = 1100+ upper limit
        //     //   (this.lifespan / 8) = 590+  upper limit
        //     //   etc...
               
        // }


        /*******************
        **                **
        ** NEW TRAILS     **
        ** SYSTEM SPAWN   **
        *******************/
        this.forwardDir = this.velocity.clone().normalize();
        if (this.age < this.lifespan / 4)
        {
            this.instancedTrails.spawn(
                this.myPosition,
                this.velocity.clone().multiplyScalar(0.05)
            );
        }


    }

    destroy()
    {
        // if dead return
        if(!this.alive) return;
        this.alive = false;

        // remove object from scene
        if (this.mesh.parent)
        {
            this.mesh.parent.remove(this.mesh);
        }

    }
}

/********************
**                 **
** Ammunition Type **
**                 **
********************/
export class Beam
{

}

/********************
**                 **
** Ammunition Type **
**                 **
********************/
export class Rocket 
{

}

/********************
**                 **
** Ammunition Type **
**                 **
********************/
export class Missile 
{

}

/********************
**                 **
** Ammunition Type **
**                 **
********************/
export class ScatterShot
{

}

/********************
**                 **
** Ammunition Type **
**                 **
********************/
export class MagneticShot
{

}