//--------------------------------------------------------------------------------
// Copyright (c) 2019-2020, sanko-shoko. All rights reserved.
//--------------------------------------------------------------------------------

(function () { 
    'use strict';

    mog.build = function (union) {
        console.time(union.path + ' build');
        function makeObject(unit) {
            const object = new THREE.Object3D();

            for (let i = 0; i < unit.models.length; i++) {
                const model = unit.models[i];

                const bgeom = new THREE.BufferGeometry();
                bgeom.setAttribute('position', new THREE.BufferAttribute(model.buffer.vtxs, 3));
                bgeom.setAttribute('normal', new THREE.BufferAttribute(model.buffer.nrms, 3, true));
                bgeom.setAttribute('uv', new THREE.BufferAttribute(model.buffer.uvs, 2, true));
                
                let texture;
                {
                    texture = new THREE.DataTexture(model.buffer.dtex.data, model.buffer.dtex.dsize[0], model.buffer.dtex.dsize[1], THREE.RGBFormat, THREE.UnsignedByteType);
                    texture.magFilter = THREE.NearestFilter;
                    texture.minFilter = THREE.NearestFilter;
                    
                    texture.generateMipmaps = false;
                }
                const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.FrontSide, roughness: 1.0});
                const mesh = new THREE.Mesh(bgeom, material);
                mesh.texture = texture;

                mesh.castShadow = true;
                mesh.receiveShadow = true;

                mesh.position.set(-unit.dsize[0] / 2.0, 0.0, -unit.dsize[2] / 2.0);
                const wrap = new THREE.Object3D();
                wrap.add(mesh);

                object.add(wrap);
            }
            return object;
        };

        union.object = new THREE.Object3D();

        if (union.layouts.length > 0) {

            for (let l = 0; l < union.layouts.length; l++) {
                const layout = union.layouts[l];

                const vox = makeObject(layout.unit);
                vox.position.set(layout.pos[0], layout.pos[1], layout.pos[2]);
                vox.rotation.set(layout.ang[0] * Math.PI / 180, layout.ang[1] * Math.PI / 180, layout.ang[2] * Math.PI / 180);
                vox.scale.set(layout.scl[0], layout.scl[1], layout.scl[2]);

                union.object.add(vox);
            }
        }
        else {
            union.object.add(makeObject(union.units[0]));
        }

        for (let u = 0; u < union.units.length; u++) {
            for (let i = 0; i < union.units[u].models.length; i++) {
                const model = union.units[u].models[i];
                model.buffer = null;
            }
        }
        console.timeEnd(union.path + ' build');    
    }

    mog.load = function(url, post, params = {}){
        if (0) {
            const loaded = function (union) {
                if (union) mog.build(union);
                post(union);
            };
            mog._load(url, loaded, params);
        }
        else{
            const wk = new Worker(_url('/js/mog3d.js'));
            wk.onmessage = function(message) {
                if (message.data.union) { mog.build(message.data.union); }
                post(message.data.union);
            };
            wk.postMessage({url: url, params: params, });
        }
    }

})();


(function() {
    'use strict';

    function _gl(mog_viewport, mog_canvas, params = {}) {
        const buffer = (params.preserveDrawingBuffer) ? true : false;
        const fov = (params.fov === undefined) ? 60 : params.fov;
        const move = (params.move === undefined || params.move) ? true : false;
        const antialias = (params.antialias === undefined || params.antialias) ? true : false;
        const smapscale = (params.smapscale) ? params.smapscale : 0.6;

        const gl = this;
        {
            gl.renderer = new THREE.WebGLRenderer({ canvas: mog_canvas, antialias: antialias, alpha: true, preserveDrawingBuffer: buffer, });
            gl.renderer.sortObjects = false;
            gl.renderer.setClearColor(0xFFFFFF, 0.0);
            gl.renderer.shadowMap.enabled = true;
            gl.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            gl.camera = new THREE.PerspectiveCamera(fov, mog_viewport.clientWidth / mog_viewport.clientHeight, 0.1, 1000.0);
        }

        function resize() {
            const w = mog_viewport.clientWidth;
            const h = mog_viewport.clientHeight;

            let size = new THREE.Vector2();
            gl.renderer.getSize(size);

            let _fov;
            if(gl.camera.aspect > 1){
                const r = (gl.camera.aspect - 1) / 5;
                _fov = fov * Math.max(0.7, (1.0 + r) * h / Math.sqrt(w * h));
            }
            else{
                _fov = fov * Math.max(0.7, 0.5 * (h + w) / Math.sqrt(w * h));
            }

            if(w == size.x && h == size.y && gl.camera.fov == _fov) return;
            console.log(size, w, h, gl.camera.fov, _fov);

            gl.renderer.setPixelRatio(window.devicePixelRatio);
            gl.renderer.setSize(w, h);
            gl.camera.aspect = w / h;
            gl.camera.fov = _fov;
            gl.camera.updateProjectionMatrix();
        }
        resize();
        window.addEventListener('resize', resize);

        gl.scene = new THREE.Scene();
        {
            gl.layers = new Array(3);
            for(let i = 0; i < gl.layers.length; i++){
                gl.layers[i] = new THREE.Object3D();
                gl.scene.add(gl.layers[i]);
            }

            gl.scene.fog = new THREE.Fog(0xFFFFFF, 0.1, 30.0);

            gl.drcLight = new THREE.DirectionalLight(0xFFFFFF, 0.34);
            gl.scene.add(gl.drcLight);

            gl.drcLight2 = new THREE.DirectionalLight(0xFFFFFF, 0.09);
            gl.scene.add(gl.drcLight2);

            gl.ambLight = new THREE.AmbientLight(0xFFFFFF, 0.74, 0);
            gl.scene.add(gl.ambLight);

            gl.drcLight.castShadow = true;
            gl.drcLight.shadow.bias = -0.0001;
            gl.drcLight.shadow.mapSize.width = 1024;
            gl.drcLight.shadow.mapSize.height = 1024;
            gl.drcpos = [3.0, 6.0, 4.0];
        }

        gl.render = function () {
            const d = gl.camera.position.length();
            {
                const f = Math.max(d, 5.0);
                gl.scene.fog.near = f * 1.0;
                gl.scene.fog.far  = f * 30.0;

                gl.camera.near = d * 0.1;
                gl.camera.far = f * 60.0;
            }

            {
                const r = Math.abs(gl.camera.position.y) / gl.camera.position.length();

                const s = Math.max(d, 1.4);
                const t = d * (2 - r);

                gl.drcLight.shadow.bias = -0.0001;
                gl.drcLight.position.set(s * gl.drcpos[0], s * gl.drcpos[1], s * gl.drcpos[2]);
                gl.drcLight2.position.set(-s * gl.drcpos[0], -s * gl.drcpos[1] * 0.1, -s * gl.drcpos[2] * 0.5);
                gl.drcLight.shadow.camera.left   = -t * smapscale;
                gl.drcLight.shadow.camera.right  = +t * smapscale;
                gl.drcLight.shadow.camera.top    = -t * smapscale;
                gl.drcLight.shadow.camera.bottom = +t * smapscale;
                gl.drcLight.shadow.camera.near   = +s * smapscale;
                gl.drcLight.shadow.camera.far    = +s * 100.0;
                gl.drcLight.shadow.camera.fov    = 50;
                gl.drcLight.shadow.camera.updateProjectionMatrix ();

            }
            
            gl.camera.updateProjectionMatrix();
            gl.renderer.render(gl.scene, gl.camera);
        };
        
        gl.clock = new THREE.Clock();

        //const stats = new Stats();
        //stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        //document.body.appendChild(stats.dom);
        let frame = 0;
        function update() {
            resize();
            if (move === true && gl.loop !== false){
                requestAnimationFrame(update);
            }
            else{
                if (gl.update) gl.update();
                gl.render();

                gl.remove(gl.layers[0]);
                gl.remove(gl.layers[1]);
                gl.remove(gl.layers[2]);
                return;
            }

            frame++;
            if (frame % 2 == 0) {
                return;
            }

            // stats.begin();
            if (gl.update) gl.update();
            gl.render();
            // stats.end();
        };

        gl.start = function(){
            update();
        }
    }

    mog.gl = _gl;

    mog.tex = {};

    mog.tex.block = (function () {
        const m = 16;
        const s = m * 8;
        const data = new Uint8Array(s * s * 3);
        const c = (s - 1) / 2.0;

        for (let v = 0; v < s; v += m) {
            for (let u = 0; u < s; u += m) {
                const r = Math.round(Math.random() * 8);

                for (let y = 0; y < m; y++) {
                    for (let x = 0; x < m; x++) {
                        let val = 0;

                        const t = Math.max(Math.abs((v + y) - c), Math.abs((u + x) - c)) - c;
                        if (t < -1.0) {
                            val = Math.round(255 - 0);
                        }
                        else if (t < 0.0) {
                            val = Math.round(255 - 16);
                        }
                        else {
                            val = Math.round(255 - 31);
                        }

                        const p = ((v + y) * s + (u + x)) * 3;
                        data[p + 0] = val - r;
                        data[p + 1] = val - r;
                        data[p + 2] = val - r;
                    }
                }
            }
        }

        const tex = new THREE.DataTexture(data, s, s, THREE.RGBFormat, THREE.UnsignedByteType);
        //tex.needsUpdate = true;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    })();

    function genDomeTex(param) {
        const s = 32;
        const data = new Uint8Array(s * s * 3);

        const g = param.gradation;
        for (let v = 0; v < s; v++) {
            for (let u = 0; u < s; u++) {
                const p = (v * s + u) * 3;
                const t = (s - 1) / 2;
                if(v > t){
                    data[p + 0] = Math.round(g[0][0] + ((g[1][0] - g[0][0]) * (v - t) / t));
                    data[p + 1] = Math.round(g[0][1] + ((g[1][1] - g[0][1]) * (v - t) / t));
                    data[p + 2] = Math.round(g[0][2] + ((g[1][2] - g[0][2]) * (v - t) / t));
                }
                else{
                    data[p + 0] = g[0][0];
                    data[p + 1] = g[0][1];
                    data[p + 2] = g[0][2];
                }
            }
        }
        const tex = new THREE.DataTexture(data, s, s, THREE.RGBFormat, THREE.UnsignedByteType);
        //tex.needsUpdate = true;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    };

    mog.tex.stddome = genDomeTex({ gradation: [[238, 244, 248], [255, 255, 255]], });
    mog.tex.skydome = genDomeTex({ gradation: [[ 130, 240, 255], [ 40,  70, 205]], });

    _gl.prototype.mkDome = function (size, params) {
        const dome = { object: null };
        dome.object = new THREE.Mesh(new THREE.SphereGeometry(size, 25, 25), new THREE.MeshBasicMaterial(params));
        dome.object.material.side = THREE.BackSide;

        dome.upscale = function(scale){
            dome.object.scale.set(scale, scale, scale);
        }
        return dome;
    }

    _gl.prototype.mkGround = function (size, params){
        const ground = { object: null };
        ground.object = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), new THREE.MeshLambertMaterial(params));
        ground.object.rotation.x = -90 / 180 * Math.PI
        ground.object.receiveShadow = true;
        ground.object.material.opacity = 0.7;
        return ground;
    }

    function _remove (obj) { 
        while(obj.children.length > 0){ 
            _remove(obj.children[0]) 
            obj.remove(obj.children[0]); 
        } 
        if (obj.geometry) obj.geometry.dispose() 
        if (obj.material) obj.material.dispose() 
        if (obj.texture) obj.texture.dispose() 
    }

    _gl.prototype.remove = function (obj) { 
        const parent = obj.parent;
        _remove(obj);
        parent.remove(obj);
    } 
})();


