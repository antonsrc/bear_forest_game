


var canvas = document.getElementById('renderCanvas');
var engine = new BABYLON.Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true}, false);

// Create world
var scene = new BABYLON.Scene(engine);
scene.ambientColor = new BABYLON.Color3(1,1,1);

const light = new BABYLON.DirectionalLight("light1", new BABYLON.Vector3(0.7, -1, 0), scene);
var light2 = new BABYLON.HemisphericLight('light2', new BABYLON.Vector3(0, 1, 0), scene);
light.autoCalcShadowZBounds = true;
light2.intensity = 0.8;
light2.specular = BABYLON.Color3.Black();
const shadowGenerator = new BABYLON.ShadowGenerator(2048, light);



var createScene = function(){
    var camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5, -15), scene);
    camera.setTarget(BABYLON.Vector3.Zero(0,0,0));
    camera.attachControl(canvas, false);
    
    const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 4, segments: 32}, scene);
    sphere.position.x = 3;
    sphere.position.z = -3;
    sphere.position.y = 1;
    shadowGenerator.getShadowMap().renderList.push(sphere);

    var sphereMaterial = new BABYLON.StandardMaterial("sphereMaterial", scene);
    sphereMaterial.ambientColor = new BABYLON.Color3(0.3,0.3,0.3);
    sphereMaterial.diffuseColor = new BABYLON.Color3(0,0.5,1);
    sphere.material = sphereMaterial; 
    


    
    const MAP_SIZE = 100;

    var ground = BABYLON.MeshBuilder.CreateGround("ground1", { 
        width: MAP_SIZE, 
        height: MAP_SIZE, 
        subdivisions: 2, 
        updatable: false }, scene);
    const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseColor = BABYLON.Color3.FromHexString("#78a3b0");
    ground.material = groundMaterial;
    ground.receiveShadows = true;

    




    // Append glTF model to scene.
    BABYLON.SceneLoader.ImportMeshAsync(null, "./public/", "8_animation_0.gltf", scene
            ).then((result) => {
            const [root] = result.meshes;
            //console.log({result});
            shadowGenerator.addShadowCaster(root);

            const playIdle = function(){
                result.animationGroups.forEach((ag) => {
                    if (ag.name === "idle") {
                        ag.start(true);
                    }
                    else {
                        ag.stop();
                    }
                });
            }

            const playMove = function(){
                result.animationGroups.forEach((ag) => {
                    if (ag.name === "move") {
                        ag.start(true);
                    }
                    else {
                        ag.stop();
                    }
                });
            }

            playIdle();

            //root.rotate(BABYLON.Vector3.Up(), Math.PI*2)
            //root.rotate(BABYLON.Vector3.Up(), Math.PI)
            root.rotationQuaternion = BABYLON.Quaternion.Identity();
            
            root.scaling.setAll(1);
            root.position.x = 0;

            const targetPoint = root.position.clone();
            const targetRotation = root.rotationQuaternion.clone();
            


            scene.onPointerObservable.add(eventData=>{
                //console.log(eventData);
                if(eventData.type !== BABYLON.PointerEventTypes.POINTERPICK) return;

                const pickedMesh = eventData.pickInfo?.pickedMesh;
                if(pickedMesh == null) return;

                if(pickedMesh.name !== "ground1") return;

                const pickedPoint = eventData.pickInfo?.pickedPoint;
                if(pickedPoint == null) return;

                targetPoint.copyFrom(pickedPoint);

                const dir = targetPoint.subtract(root.position).normalize();
                targetRotation.copyFrom(
                    BABYLON.Quaternion.FromLookDirectionLH(dir,root.up)
                );
            });

            const pressedKeys = {};

            const keys = {
                KeyW:1,
                KeyS:-1,
                KeyA:-1,
                KeyD:1,
            };

            const axis = {
                f:0,
                r:0,
            };

            const speed = 7;
            const maxDelta = speed*0.01;
            const rotLerpSpeed = 10;
            const rotAmount = 5;

            scene.onKeyboardObservable.add(eventData=>{
                const code = eventData.event.code;
                //console.log(eventData);
                const getKey = (c) => {
                    return !!pressedKeys[c] ? keys[c] : 0;
                };

                if(eventData.type === BABYLON.KeyboardEventTypes.KEYDOWN){
                    pressedKeys[code] = 1;
                } else if (eventData.type === BABYLON.KeyboardEventTypes.KEYUP){
                    pressedKeys[code] = 0;
                }

                axis.f = getKey("KeyW") + getKey("KeyS");
                axis.r = getKey("KeyA") + getKey("KeyD");
            });


            scene.onBeforeRenderObservable.add(()=>{
                const deltaTime = (scene.deltaTime ?? 1) / 1000;

                if(Math.abs(axis.f) > 0.001) {
                    const nextPoint = root.position.add(root.forward.scale(axis.f * 0.3));
                    targetPoint.copyFrom(nextPoint);
                }

                if(Math.abs(axis.r) > 0.001) {
                    targetRotation.multiplyInPlace(
                        BABYLON.Quaternion.RotationAxis(
                            root.up,
                            axis.r * rotAmount * deltaTime
                        )
                    );
                } 

                BABYLON.Quaternion.SlerpToRef(
                    root.rotationQuaternion,
                    targetRotation,
                    rotLerpSpeed * deltaTime,
                    root.rotationQuaternion
                );


                const diff = targetPoint.subtract(root.position);

                if(diff.length() < maxDelta){
                    playIdle();
                    return;
                }
                playMove();


                const dir = diff.normalize();

                const velocity = dir.scale(speed*deltaTime);
                root.position.addInPlace(velocity);
            });

    });

    

    BABYLON.SceneLoader.ImportMeshAsync(null, "./public/", "tree.gltf", scene
    ).then((result) => {
        const [root] = result.meshes;
        root.scaling.setAll(1);
        
        const childMeshes = root.getChildMeshes(false);
        const merged = BABYLON.Mesh.MergeMeshes(
            childMeshes,
            true,
            true,
            undefined,
            false,
            true
        );
        merged.isPickable = false;
        merged.checkCollisions = false;
        shadowGenerator.addShadowCaster(merged);
        const COUNT = 100;
        const offset = 3;
        const max = (MAP_SIZE/2)-offset;

        const getPos = () =>
            (offset + Math.random() * max) * (Math.random() > 0.5 ? 1 : -1);
        const bufferMatrix = new Float32Array(16*COUNT);
        for(let i = 0; i < COUNT; i++){
            const x = getPos();
            const z = getPos();
            const pos = new BABYLON.Vector3(x,0,z);
            const scale = BABYLON.Vector3.One().setAll(BABYLON.Scalar.RandomRange(1,2));
            const angle = BABYLON.Scalar.RandomRange(0, 2 * Math.PI);
            const rot = BABYLON.Quaternion.FromEulerAngles(0, angle, 0);
      
            const matrix = BABYLON.Matrix.Compose(scale, rot, pos);
      
            matrix.copyToArray(bufferMatrix, i * 16);
        }
        merged.thinInstanceSetBuffer("matrix", bufferMatrix, 16, true);

        merged.alwaysSelectAsActiveMesh = true;
    })



    // Return the created scene
    return scene;
}



var scene = createScene();
engine.runRenderLoop(function(){
    scene.render();
});


// show inspector
scene.debugLayer.show();

window.addEventListener('resize', function(){
    engine.resize();
});


// для PWA только
window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
})
