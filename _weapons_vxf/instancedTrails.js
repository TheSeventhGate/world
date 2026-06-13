// instancedTrails.js
import * as THREE from 'three/webgpu';

export class InstancedTrails
{

    /**********************
    **                   **
    ** START CONSTR      **
    **                   **
    **********************/
    constructor(worldGroup)
    {
        this.dt = 0.0;
        this.world = worldGroup;
        this.count = 10000;
        this.geometry = new THREE.PlaneGeometry(0.5, 0.5, 1, 1);
        this.material = new THREE.MeshBasicMaterial( { color: 0xb30000, side: THREE.FrontSide } );
        this.mesh = new THREE.InstancedMesh( this.geometry, this.material, this.count );

        // instanced mesh uniqes 
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // Tell GPU we update this every frame
        this.mesh.frustumCulled = false; // Prevent particles from disappearing when they travel far

        // trail.js similar effects
        this.baseSpeed = 4.0;     // forward speed like your laser
        this.spreadSpeed = 4.0;  // sideways drift strength
        this.driftStrength = 2.0; // global multiplier 
        this.material.vertexColors = true;


        /**********************
        **                   **
        ** CPU PARTICLE POOL **
        **                   **
        **********************/
        this.particles = [];

        // IMPORTANT: one reusable transform (per system, not per particle)
        this._transform = new THREE.Object3D();
        this._scratchQuat = new THREE.Quaternion();

        for (let i = 0; i < this.count; i++)
        {
            this.particles.push({
                alive: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                random: new THREE.Vector3(),
                age: 0,
                maxAge: 1.0,
                lifePercent: 0,
                spreadFactor: 1.0
            });

            // initialize hidden
            this._transform.scale.set(0, 0, 0);
            this._transform.updateMatrix();

            this.mesh.setMatrixAt(i, this._transform.matrix);

            this.mesh.setColorAt(i, new THREE.Color(0x000000));
        }

        this.world.add(this.mesh);
        this.mesh.instanceMatrix.needsUpdate = true;
    }
    /**********************
    **                   **
    ** END CONSTR        **
    **                   **
    **********************/

    /**********************
    **                   **
    ** SPAWN PARTICLES   **
    **                   **
    **********************/
    spawn(position, forwardDirection)
    {
        const p = this.particles.find(p => !p.alive);
        if (!p) return;

        p.alive = true;
        p.age = 0;

        p.position.copy(position);

        // BASE VELOCITY (like your old forward system)
        p.velocity
            .copy(forwardDirection)
            .normalize()
            .multiplyScalar(this.baseSpeed);

        // RANDOM SPREAD VECTOR (X/Y chaos like old trails)
        p.random
            .set(
                THREE.MathUtils.randFloatSpread(1),
                THREE.MathUtils.randFloatSpread(1),
                0
            ).normalize();
    }

    /**********************
    **                   **
    ** UPDATE PARTICLES  **
    **                   **
    **********************/
    update(dt, camera)
    {
        const t = this._transform;
        
        // Get the camera's TRUE world rotation once per frame
        camera.getWorldQuaternion(this._scratchQuat);

        for (let i = 0; i < this.count; i++)
        {
            const p = this.particles[i];

            if (!p.alive) continue;

            p.age += dt;

            const life = 1.0 - (p.age / p.maxAge);

            // smooth falloff (this is what gives the “tweened feel”)
            // p.spreadFactor = life * life;
            p.spreadFactor = Math.pow(life, 3.0);

            if (p.age > p.maxAge)
            {
                p.alive = false;
                t.scale.set(0, 0, 0);
            }
            else
            {
                p.velocity.addScaledVector(
                    p.random,
                    this.spreadSpeed * this.driftStrength * p.spreadFactor * dt
                );
                p.position.addScaledVector(p.velocity, dt);

                const life = 1.0 - (p.age / p.maxAge);
                t.scale.setScalar(life);

                t.position.copy(p.position);
                
                // BILLBOARD LOGIC:
                // Copy the world rotation we captured above
                t.quaternion.copy(this._scratchQuat);

                const c = new THREE.Color();
                // c.setRGB(life, life * 0.3, life * 0.1); // <-- fade strength
                // c.setRGB(life, life * 0.2, life * 0.05);
                const l = Math.pow(life, 6.0);
                c.setRGB(l, 0, 0);
                this.mesh.setColorAt(i, c);


            }

            t.updateMatrix();
            this.mesh.setMatrixAt(i, t.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
    }
}

















/*********************
**                  **
** TEMP DEBUG GRID  **
**                  **
*********************/
// const matrixDataPerMesh = new THREE.Object3D();

// let i = 0;

// //temp debug grid... spawn 10k quads and test performance
// for(let x = 0; x < 100; x++)
// {
//     for(let y = 0; y < 100; y++)
//     {
//         matrixDataPerMesh.position.set(
//             x,
//             y,
//             0
//         );

//         matrixDataPerMesh.updateMatrix();

//         this.mesh.setMatrixAt(
//             i++,
//             matrixDataPerMesh.matrix
//         );
//     }
// }