
// namespace
var mog = { };

(function () {

    mog.Transform = function () {
        this.pos = [0, 0, 0];
        this.ang = [0, 0, 0];
        this.scl = [1, 1, 1];
    };

    mog.Model = function () {
        this.name = "";
        this.trns = new mog.Transform();
        this.dsize = [0, 0, 0];

        this.vmap = [];
        this.cmap = [];
    };

    mog.Unit = function () {
        this.name = "";

        this.guide0 = false;
        this.guide1 = false;
        this.smooth = false;

        this.palette = [];

        this.models = [];
    };

    mog.Layout = function () {
        this.name = "";
        this.trns = new mog.Transform();
        this.unit = null;
    };

    mog.Stage = function () {
        this.units = [];
        this.layouts = [];

        this.object = null;
    };


})();

(function () {

    mog.load = function (url, func) {
        var reader = new spio.Reader();

        reader.parse(url,
            function (root) {
                var stage = mog.load_v1(root);
                build(stage);
                func(stage);
            }
        );

    };

    mog.load_v1 = function (root) {
        var stage = new mog.Stage();

        var code = new spio.Code();
        {
            var n_units = root.getCNodes("unit");

            for (var i = 0; i < n_units.length; i++) {
                var unit = new mog.Unit();

                const n_unit = n_units[i];
                const n_option = n_unit.getCNode("option");
                if (n_option != null) {
                    const size = n_option.elms();
                    for (var p = 0; p < size; p++) {
                        let o = n_option.getTxt(p);
                        if (o == "edge") unit.guide0 = true;
                        if (o == "grid") unit.guide1 = true;
                        if (o == "smooth") unit.smooth = true;
                    }
                }

                const n_name = n_unit.getCNode("name");
                {
                    unit.name = n_name.getTxt();
                }

                const n_palette = n_unit.getCNode("palette");
                {
                    const n_size = n_palette.getCNode("size");
                    const size = Number(n_size.getTxt(0));
                    unit.palette = new Array(size);
                    const n_cols = n_palette.getCNode("cols");

                    for (var c = 0; c < size; c++) {
                        unit.palette[c] = [n_cols.data[c * 4 + 0], n_cols.data[c * 4 + 1], n_cols.data[c * 4 + 2], n_cols.data[c * 4 + 3]];
                    }
                }

                const n_models = n_unit.getCNodes("model");

                for (var m = 0; m < n_models.length; m++) {
                    var model = new mog.Model();

                    const n_model = n_models[m];
                    { //
                        const n_name = n_model.getCNode("name");
                        {
                            model.name = n_name.getTxt();
                        }

                        const n_size = n_model.getCNode("size");
                        {
                            model.dsize[0] = Number(n_size.getTxt(0));
                            model.dsize[1] = Number(n_size.getTxt(1));
                            model.dsize[2] = Number(n_size.getTxt(2));
                        }

                        const n_trns = n_model.getCNode("trns");
                        {
                            model.trns.pos[0] = n_trns.getBin("Float32", 0 * 4);
                            model.trns.pos[1] = n_trns.getBin("Float32", 1 * 4);
                            model.trns.pos[2] = n_trns.getBin("Float32", 2 * 4);
                            model.trns.ang[0] = n_trns.getBin("Float32", 3 * 4);
                            model.trns.ang[1] = n_trns.getBin("Float32", 4 * 4);
                            model.trns.ang[2] = n_trns.getBin("Float32", 5 * 4);
                            model.trns.scl[0] = n_trns.getBin("Float32", 6 * 4);
                            model.trns.scl[1] = n_trns.getBin("Float32", 7 * 4);
                            model.trns.scl[2] = n_trns.getBin("Float32", 8 * 4);
                        }
                    }

                    //console.log(model);

                    const n_bin0 = n_model.getCNode("bin0");
                    const n_bin1 = n_model.getCNode("bin1");

                    var memA = null;
                    var memB = null;
                    var memC = null;
                    {
                        var tableB = code.table256();

                        var p = 0;
                        {
                            const size = n_bin0.getBin("Int32", p);
                            p += 4;
                            const offset = n_bin0.getBin("Uint8", p);
                            p += 1;

                            memA = n_bin0.data.slice(p, p + size);
                            p += size;
                        }
                        {
                            const size = n_bin0.getBin("Int32", p);
                            p += 4;
                            const offset = n_bin0.getBin("Uint8", p);
                            p += 1;

                            if (size > 0) {
                                const bits = size * 8 - offset;

                                var bs = n_bin0.data.slice(p, p + size);
                                var arr = code.get1BitArray(bs, bits);

                                var mem = code.zlDecode(tableB, arr, 256, 8, 8);
                                memB = code.lzssDecode(mem, 256);
                            }
                        }
                    }
                    {
                        var tableC = null;
                        var base = 0;
                        const PALETTE_CODE = 256;

                        var p = 0;
                        {
                            const size = n_bin1.getBin("Int32", p);
                            p += 4;
                            const offset = n_bin1.getBin("Uint8", p);
                            p += 1;
                            {
                                var lngs = new Array(PALETTE_CODE + 1);
                                lngs.fill(0);
                                for (var c = 0; c < size; c++) {
                                    const s = n_bin1.getBin("Uint8", p + 0);
                                    const b = n_bin1.getBin("Uint8", p + 1);
                                    p += 2;
                                    lngs[s] = b;
                                }
                                lngs[PALETTE_CODE] = offset;
                                tableC = code.hmMakeTableFromLngs(lngs);
                            }
                            //base = 2 * size + 1;
                            //console.log(tableC);
                        }
                        {
                            const size = n_bin1.getBin("Int32", p);
                            p += 4;
                            const offset = n_bin1.getBin("Uint8", p);
                            p++;

                            if (size > 0) {
                                const bits = size * 8 - offset;
                                var bs = n_bin1.data.slice(p, p + size);
                                var arr = code.get1BitArray(bs, bits);

                                var mem = code.zlDecode(tableC, arr, PALETTE_CODE, 8, 8);
                                memC = code.lzssDecode(mem, PALETTE_CODE);

                            }
                        }
                    }
                    unit.models.push(model);

                    decode1(model, memA, memB, memC, model.dsize);
                }
                stage.units.push(unit);
            }
        }
        {
            var n_layouts = root.getCNodes("layout");
            for (var i = 0; i < n_layouts.length; i++) {
                var layout = new mog.Layout();

                const n_layout = n_layouts[i];
                const n_name = n_layout.getCNode("name");
                {
                    layout.name = n_name.getTxt();
                }

                const n_trns = n_layout.getCNode("trns");
                {
                    layout.trns.pos[0] = n_trns.getBin("Float32", 0 * 4);
                    layout.trns.pos[1] = n_trns.getBin("Float32", 1 * 4);
                    layout.trns.pos[2] = n_trns.getBin("Float32", 2 * 4);
                    layout.trns.ang[0] = n_trns.getBin("Float32", 3 * 4);
                    layout.trns.ang[1] = n_trns.getBin("Float32", 4 * 4);
                    layout.trns.ang[2] = n_trns.getBin("Float32", 5 * 4);
                    layout.trns.scl[0] = n_trns.getBin("Float32", 6 * 4);
                    layout.trns.scl[1] = n_trns.getBin("Float32", 7 * 4);
                    layout.trns.scl[2] = n_trns.getBin("Float32", 8 * 4);
                }

                const n_unit = n_layout.getCNode("unit");
                {
                    layout.unit = Number(n_unit.getTxt());
                }

                stage.layouts.push(layout);
            }
        }
        return stage;
    }


    var decode1 = function (model, memA, memB, memC, dsize) {

        const step = 8;
        const msize = [
            Math.floor((dsize[0] + 7) / step),
            Math.floor((dsize[1] + 7) / step),
            Math.floor((dsize[2] + 7) / step)];

        model.vmap = new Array(dsize[0] * dsize[1] * dsize[2]);
        model.cmap = new Array(dsize[0] * dsize[1] * dsize[2]);

        var getBit = function (byte, p) {
            const mask = 0x01 << p;
            return (byte & mask) ? 1 : 0;
        };

        var a = 0;
        var b = 0;
        var c = 0;
        for (var z = 0; z < msize[2]; z++) {
            for (var y = 0; y < msize[1]; y++) {
                for (var x = 0; x < msize[0]; x++) {

                    const i = Math.floor(a / step);
                    const cnt = getBit(memA[i], a % step);
                    a++;
                    if (cnt == 0) continue;

                    var bb = 0;
                    for (var zz = 0; zz < step; zz++) {
                        for (var yy = 0; yy < step; yy++) {
                            for (var xx = 0; xx < step; xx++) {
                                const ix = x * step + xx;
                                const iy = y * step + yy;
                                const iz = z * step + zz;

                                if (xx == 0) {
                                    bb = memB[b++];
                                }
                                if (ix >= dsize[0] || iy >= dsize[1] || iz >= dsize[2]) continue;

                                const p = iz * dsize[0] * dsize[1] + iy * dsize[0] + ix;
                                if (getBit(bb, xx) == 0) {
                                    model.vmap[p] = -127;
                                    model.cmap[p] = -1;
                                }
                                else {
                                    model.vmap[p] = +127;
                                    model.cmap[p] = Math.max(0, memC[c]);
                                    c++;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    var build = function (stage) {
        const material = new THREE.MeshPhongMaterial({
            vertexColors: THREE.FaceColors ,
            //side: THREE.DoubleSide
        });
        for (var u = 0; u < stage.units.length; u++) {
            var group = new THREE.Object3D();

            var unit = stage.units[u];
            var box = [];

            for (var i = 0; i < unit.palette.length; i++) {
                const b = new THREE.BoxGeometry(1, 1, 1);
                const c = unit.palette[i];
                const t = (c[0] << 16 + c[1] << 8 + c[2]);
                for (var j = 0; j < b.faces.length; j += 2) {
                    b.faces[j].color.setRGB(c[0] / 255, c[1] / 255, c[2] / 255);
                    b.faces[j + 1].color.setRGB(c[0] / 255, c[1] / 255, c[2] / 255);
                }
                box.push(b);
            }

            for (var i = 0; i < stage.units[u].models.length; i++) {
                var geom = new THREE.Geometry();

                var model = stage.units[u].models[i];

                var offset = [(model.dsize[0] - 1) / 2, (model.dsize[1] - 1) / 2, (model.dsize[2] - 1) / 2];

                const s0 = model.dsize[0];
                const s1 = model.dsize[0] * model.dsize[1];

                var vmap = model.vmap;
                var dsize = model.dsize;
                for (var z = 0; z < model.dsize[2]; z++) {
                    for (var y = 0; y < model.dsize[1]; y++) {
                        for (var x = 0; x < model.dsize[0]; x++) {
                            const p = z * s1 + y * s0 + x;

                            if (vmap[p] > 0) {
                                var flag = false;
                                if (x == 0 || y == 0 || z == 0 || x == dsize[0] - 1 || y == dsize[1] - 1 || z == dsize[2] - 1) {
                                    flag = true;
                                }
                                else {
                                    const p0 = p - 1;
                                    const p1 = p + 1;
                                    const p2 = p - s0;
                                    const p3 = p + s0;
                                    const p4 = p - s1;
                                    const p5 = p + s1;
                                    if (
                                        vmap[p0] > 0 || vmap[p1] > 0 || vmap[p2] > 0 ||
                                        vmap[p3] > 0 || vmap[p4] > 0 || vmap[p5] > 0) {
                                        flag = true;
                                    }
                                }
                                if (flag == true) {
                                    const c = model.cmap[p];
                                    var mesh = new THREE.Mesh(box[c]);
                                    mesh.position.set(x - offset[0], y - offset[1], z - offset[2]);
                                    mesh.updateMatrix();
                                    geom.merge(mesh.geometry, mesh.matrix);
                                }
                            }
                        }
                    }
                }
                group.add(new THREE.Mesh(geom, material));
            }

            unit.vox = group;

        }

        {
            var group = new THREE.Object3D();

            for (var l = 0; l < stage.layouts.length; l++) {
                const u = stage.layouts[l].unit;
                const unit = stage.units[u];
                const trns = stage.layouts[l].trns;

                var vox = new THREE.Object3D();
                vox.copy(unit.vox, true);

                var offset = (unit.models[0].dsize[1] - 1) / 2;
                vox.position.set(trns.pos[0], trns.pos[1] + offset, trns.pos[2]);
                vox.rotation.set(trns.ang[0] * 3.14 / 180, trns.ang[1] * 3.14 / 180, trns.ang[2] * 3.14 / 180);
                group.add(vox);
            }
            stage.object = group;
        }

        //var matrix = new THREE.Matrix4();
        //matrix.makeTranslation(1000, 0, 0);
        //vox.matrix.setPosition(new THREE.Vector3(100, 100, 0));

    }
})();


var mogtest = function () {
    var func = function (stage) {

        // サイズを指定
        const width = 640;
        const height = 480;

        // レンダラーを作成
        const renderer = new THREE.WebGLRenderer({
            canvas: document.querySelector('#mogcanvas')
        });
        renderer.setSize(width, height);
        renderer.setClearColor(0xffffff);

        // シーンを作成
        const scene = new THREE.Scene();

        // カメラを作成
        const camera = new THREE.PerspectiveCamera(
            45,
            width / height,
            1,
            10000
        );
        camera.position.set(40, 50, +130);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        // コンテナーを作成
        const container = new THREE.Object3D();
        scene.add(container);


        // 平行光源を作成
        const directionalLight = new THREE.DirectionalLight(0x888888);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);
        // 環境光を作成
        const ambientLight = new THREE.AmbientLight(0x888888);
        scene.add(ambientLight);

        {
            container.add(stage.object);
            //container.add(stage.units[0].vox);
        }
        tick();

        var clicked = false;
        // 毎フレーム時に実行されるループイベントです
        function tick() {
            // メッシュを回転させる
            if (clicked == false) {
                container.rotation.y += 0.002;
            }

            // レンダリング
            renderer.render(scene, camera);

            requestAnimationFrame(tick);
        }

        {
            var mousedown = false;
            renderer.domElement.addEventListener('mousedown', function (e) {
                mousedown = true;
                clicked = true;
                prevPosition = { x: e.pageX, y: e.pageY };
            }, false);

            renderer.domElement.addEventListener('mousemove', function (e) {
                if (!mousedown) return;
                moveDistance = { x: prevPosition.x - e.pageX, y: prevPosition.y - e.pageY };
                container.rotation.x -= moveDistance.y * 0.01;
                container.rotation.y -= moveDistance.x * 0.01;

                prevPosition = { x: e.pageX, y: e.pageY };
                renderer.render(scene, camera);
            }, false);

            renderer.domElement.addEventListener('mouseup', function (e) {
                mousedown = false;
            }, false);
        }
    };
    mog.load("https://www.mog3d.com/model.mog", func);

}