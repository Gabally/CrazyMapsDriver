
class CrazyMapDriver {
    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.style.background = "grey";
        this.canvas.width = 1536;
        this.canvas.height = 1024;
        this.canvas.style.imageRendering = "pixelated";
        window.addEventListener("resize", () => this.resizeCanvas());
        this.ctx = this.canvas.getContext("2d");
        this.ctx.font = "25px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "white";
        this.isRunning = false;
        this.lastTimeStamp = 0;
        this.TILE_DIMENSION = 512;
        this.carDimensions = 80;
        this.ratio = 16/9;
        this.position = { x: 277406 * this.TILE_DIMENSION, y: 187694 * this.TILE_DIMENSION };
        this.gmap = null;
        this.carSprite = null;
        this.keyboard = new KeyboardManager();
        this.speed = 6;
        this.powerFactor = 0.003;
        this.reverseFactor = 0.2;
        this.maxPower = 0.4;
        this.maxReverse = 0.2;
        this.turnSpeed = 0.002;
        this.angularDrag = 0.95;
        this.drag = 0.95;
        this.car = {
            xVelocity: 0,
            yVelocity: 0,
            power: 0,
            reverse: 0,
            angle: 0,
            angularVelocity: 0
        }
        this.ws = null;
        this.netCars = {};
        this.netPlayers = {};
        this.canvasCenterX = this.canvas.width / 2;
        this.canvasCenterY = this.canvas.height / 2;
        this.halfCar = this.carDimensions / 2;
        this.socket = new Worker("socketworker.js");
        this.pktDataFields = {
            ID: 0,
            X_VELOCITY: 1,
            Y_VELOCITY: 2,
            POWER: 3,
            REVERSE: 4,
            ANGLE: 5,
            ANGULAR_VELOCITY: 6,
            X_POS: 7,
            Y_POS: 8
        }
        this.lastNetUpdate = 0;
        this.deltaNetUpdate = 100;
        this.touchForward = false;
        this.touchReverse = false;
        this.touchLeft = false;
        this.touchRight = false;
    }

    resizeCanvas() {
        let newWidth = window.innerWidth - 10;
        let newHeight = window.innerHeight - 10;
        let newWidthToHeight = newWidth / newHeight;
        if (newWidthToHeight > this.ratio) {
          newWidth = newHeight * this.ratio;
          this.canvas.style.height = newHeight + "px";
          this.canvas.style.width = newWidth + "px";
        } else {
          newHeight = newWidth / this.ratio;
          this.canvas.style.width = newWidth + "px";
          this.canvas.style.height = newHeight + "px";
        }
    }

    update(time) {
        let deltaTime = (time - this.lastTimeStamp) / 15;
        if (this.keyboard.isKeyPressed("KeyW") || this.touchForward) {
            this.car.power += this.powerFactor * deltaTime;
        } else {
            this.car.power -= this.powerFactor * deltaTime;
        }
        if (this.keyboard.isKeyPressed("KeyS") || this.touchReverse) {
            this.car.reverse += this.reverseFactor * deltaTime;
        } else {
            this.car.reverse -= this.reverseFactor * deltaTime;
        }

        this.car.power = Math.max(0, Math.min(this.maxPower, this.car.power));
        this.car.reverse = Math.max(0, Math.min(this.maxReverse, this.car.reverse));

        const direction = this.car.power > this.car.reverse ? 1 : -1;

        if (this.keyboard.isKeyPressed("KeyA") || this.touchLeft) {
            this.car.angularVelocity -= direction * this.turnSpeed * deltaTime;
        }
        if (this.keyboard.isKeyPressed("KeyD") || this.touchRight) {
            this.car.angularVelocity += direction * this.turnSpeed * deltaTime;
        }

        let eVel = this.car.power - this.car.reverse;

        this.car.xVelocity += Math.sin(this.car.angle) * eVel;
        this.car.yVelocity += Math.cos(this.car.angle) * eVel;

        this.position.x += this.car.xVelocity;
        this.position.y -= this.car.yVelocity;
        this.car.xVelocity *= this.drag;
        this.car.yVelocity *= this.drag;
        this.car.angle += this.car.angularVelocity;
        this.car.angularVelocity *= this.angularDrag;
        for (const netCar in this.netCars) {
            this.netCars[netCar][this.pktDataFields.POWER] = Math.max(0, Math.min(this.maxPower, this.netCars[netCar][this.pktDataFields.POWER]));
            this.netCars[netCar][this.pktDataFields.REVERSE] = Math.max(0, Math.min(this.maxReverse, this.netCars[netCar][this.pktDataFields.REVERSE]));
            let eVel = this.netCars[netCar][this.pktDataFields.POWER] - this.netCars[netCar][this.pktDataFields.REVERSE];
            this.netCars[netCar][this.pktDataFields.X_VELOCITY] += Math.sin(this.netCars[netCar][this.pktDataFields.ANGLE]) * eVel;
            this.netCars[netCar][this.pktDataFields.Y_VELOCITY] += Math.cos(this.netCars[netCar][this.pktDataFields.ANGLE]) * eVel;
            this.netCars[netCar][this.pktDataFields.X_POS] += this.netCars[netCar][this.pktDataFields.X_VELOCITY];
            this.netCars[netCar][this.pktDataFields.Y_POS] -= this.netCars[netCar][this.pktDataFields.Y_VELOCITY];
            this.netCars[netCar][this.pktDataFields.X_VELOCITY] *= this.drag;
            this.netCars[netCar][this.pktDataFields.Y_VELOCITY] *= this.drag;
            this.netCars[netCar][this.pktDataFields.ANGLE] += this.netCars[netCar][this.pktDataFields.ANGULAR_VELOCITY];
            this.netCars[netCar][this.pktDataFields.ANGULAR_VELOCITY] *= this.angularDrag;
        }
        if ((time - this.lastNetUpdate) >= this.deltaNetUpdate) {
            this.socket.postMessage({ car: this.car, pos: this.position });
            this.lastNetUpdate = time;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        let startCol = Math.floor(this.position.x / this.TILE_DIMENSION) - 1;
        let endCol = startCol + (this.canvas.width / this.TILE_DIMENSION) + 1;
        let startRow = Math.floor(this.position.y / this.TILE_DIMENSION) - 1;
        let endRow = startRow + (this.canvas.height / this.TILE_DIMENSION) + 1;
        let offsetX = -this.position.x + startCol * this.TILE_DIMENSION;
        let offsetY = -this.position.y + startRow * this.TILE_DIMENSION;
        for (let c = startCol; c <= endCol; c++) {
            for (let r = startRow; r <= endRow; r++) {
                let tile = this.gmap.getTile({ x: c, y: r });
                let x = (c - startCol) * this.TILE_DIMENSION + offsetX;
                let y = (r - startRow) * this.TILE_DIMENSION + offsetY;
                this.ctx.drawImage(
                    tile,
                    Math.round(x),
                    Math.round(y),
                    this.TILE_DIMENSION,
                    this.TILE_DIMENSION
                );
            }
        }
        this.ctx.translate(this.canvasCenterX, this.canvasCenterY);
        this.ctx.rotate(this.car.angle);
        this.ctx.translate(-this.canvasCenterX, -this.canvasCenterY);
        this.ctx.drawImage(
            this.carSprite,
            this.canvasCenterX - this.halfCar,
            this.canvasCenterY - this.halfCar,
            this.carDimensions,
            this.carDimensions
        );
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (const carK in this.netCars) {
            let netX = this.netCars[carK][this.pktDataFields.X_POS] - this.position.x + this.canvasCenterX;
            let netY =  this.netCars[carK][this.pktDataFields.Y_POS] - this.position.y + this.canvasCenterY;
            this.ctx.translate(netX, netY);
            this.ctx.rotate(this.netCars[carK][this.pktDataFields.ANGLE]);
            this.ctx.translate(-netX, -netY);
            this.ctx.drawImage(
                this.carSprite,
                netX - this.halfCar,
                netY - this.halfCar,
                this.carDimensions,
                this.carDimensions
            );
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.fillText(this.netPlayers[carK], netX, netY - 25); 
        }
    }

    mainloop(t) {
        if (!this.isRunning) {  return; }
        this.update(t);
        this.draw();
        this.lastTimeStamp = t;
        requestAnimationFrame((time) => {
            this.mainloop(time)
        });
    }

    async run() {
        this.isRunning = true;
        this.resizeCanvas();
        this.gmap = new GoogleMapsSatellite();
        await this.gmap.init();
        this.carSprite = await this.loadImage("imgs/car.png");
        this.keyboard.startListening();
        try {
            let geoipReq = await fetch("https://reallyfreegeoip.org/json/");
            let geolocation = await geoipReq.json();
            this.setPosition(geolocation.latitude,geolocation.longitude);
        } catch(e) {
            console.error("Unknown error occurred while fetching geolocation data");
        }
        this.socket.onmessage = (event) => {
            try {
                if (event.data.startsWith("!")) {
                    let command = event.data.substring(1);
                    let [username,id] = command.split("|");
                    this.netPlayers[id] = username;
                } else if (event.data.startsWith("#")) {
                    let pid = event.data.substring(1);
                    delete this.netPlayers[pid];
                    delete this.netCars[pid];
                } else {
                    let pkt = event.data.split("|").map(e => parseFloat(e));
                    this.netCars[pkt[this.pktDataFields.ID]] = pkt;
                }
            } catch(error) {
                console.error("Bogus data received from other client");
                console.error(error);
            }
        }
        this.socket.postMessage({ connect: `${window.location.protocol === "http:" ? "ws" : "wss"}://${window.location.host}` });
        this.canvas.addEventListener("touchstart", (e) => this.touchStart(e));
        this.canvas.addEventListener("touchend", (e) => this.touchEnd(e));
        let fwdTouch = document.getElementById("t-f");
        fwdTouch.addEventListener("touchstart", () => { this.touchForward = true; }, false);
        fwdTouch.addEventListener("touchend", () => { this.touchForward = false; }, false);
        let bckwdTouch = document.getElementById("t-b");
        bckwdTouch.addEventListener("touchstart", () => { this.touchReverse = true; }, false);
        bckwdTouch.addEventListener("touchend", () => { this.touchReverse = false; }, false);
        let leftTouch = document.getElementById("t-l");
        leftTouch.addEventListener("touchstart", () => { this.touchLeft = true; }, false);
        leftTouch.addEventListener("touchend", () => { this.touchLeft = false; }, false);
        let rightTouch = document.getElementById("t-r");
        rightTouch.addEventListener("touchstart", () => { this.touchRight = true; }, false);
        rightTouch.addEventListener("touchend", () => { this.touchRight = false; }, false);
        window.addEventListener("orientationchange", () => {
            this.resizeCanvas();
        }, false);
        this.mainloop(0);
    }

    stop() {
        this.isRunning = false;
    }

    async loadImage(url) {
        return  new Promise((resolve, reject) => {
            let img = document.createElement("img");
            img.src = url;
            img.onload = () => {
                resolve(img);
            }
            img.onerror = (e) => {
                reject(e);
            }
        });
    }

    setPosition(lat, long) {
        const n = Math.pow(2, 19);
        this.position.x = parseInt(Math.floor((long + 180) * n / 360)) * this.TILE_DIMENSION;
        this.position.y = parseInt(Math.floor((n/2)*(1-(Math.asinh(Math.tan((lat * (Math.PI/180)))))/Math.PI))) * this.TILE_DIMENSION;
    }
}

class GoogleMapsSatellite {
    constructor() {
        this.map = {};
        this.dimensions = 256;
    }

    async init() {
        this.placeholder = await this.generatePlaceholder();
    }

    generatePlaceholder() {
        return new Promise((resolve) => {
            let canvas = document.createElement("canvas");
            canvas.width = this.dimensions;
            canvas.width = this.dimensions;
            let ctx = canvas.getContext("2d");
            ctx.fillStyle = "grey";
            ctx.fillRect(0, 0, this.dimensions, this.dimensions);
            let url = canvas.toDataURL("image/jpeg");
            let img = document.createElement("img");
            img.src = url;
            img.onload = () => {
                resolve(img);
            };
        });
    }

    getTile(pos) {
        let tile = this.map[`${pos.x}|${pos.y}`];
        if (tile) {
            return tile;
        } else {
            this.getSatelliteTile(pos).then(t => this.map[`${pos.x}|${pos.y}`] = t);
            return this.placeholder;
        }
    }

    async getSatelliteTile(pos) {
        return  new Promise((resolve, reject) => {
            let img = document.createElement("img");
            img.src = `https://khms1.googleapis.com/kh?v=917&hl=en-US&x=${pos.x}&y=${pos.y}&z=19`;
            img.onload = () => {
                resolve(img);
            }
            img.onerror = (e) => {
                reject(e);
            }
        });
    }
}

class KeyboardManager {
    constructor() {
        this.pressedKeys = [];
        this.callbacks = {};
        this.clearKeys();
    }

    keyDown(e) {
        if (!this.pressedKeys.includes(e.code)) {   
           this.pressedKeys.push(e.code);
        }
        if (!e.repeat && this.callbacks[e.code]) {
            this.callbacks[e.code].forEach(cb => cb());
        }
    }

    keyUp(e) {
        this.pressedKeys.indexOf(e.code) !== -1 && this.pressedKeys.splice(this.pressedKeys.indexOf(e.code), 1);
    }

    clearKeys() {
        this.pressedKeys = [];
    }

    startListening() {
        window.addEventListener("keydown", (e) => this.keyDown(e));
        window.addEventListener("keyup", (e) => this.keyUp(e));
        window.addEventListener("blur", () => this.clearKeys());
    }

    stopListening() {
        window.removeEventListener("keydown", (e) => this.keyDown(e));
        window.removeEventListener("keyup", (e) => this.keyUp(e));
        window.removeEventListener("blur", () => this.clearKeys())
    }

    isKeyPressed(key) { 
        return this.pressedKeys.includes(key);
    }

    atKeyPressed(keyCode, cb) {
        if (this.callbacks[keyCode] == undefined) {
            this.callbacks[keyCode] = [];
        }
        this.callbacks[keyCode].push(cb);
    }
}


window.onload = () => {
    let canvas = document.getElementById("game");
    window.game = new CrazyMapDriver(canvas);
    game.run();
    let positionButton = document.getElementById("pos-btn");
    positionButton.addEventListener("click", () => {
        let pos = prompt("GPS Coordinates:");
        if (pos) {
            let [lat, long] = pos.split(",").map(e => parseFloat(e));
            game.setPosition(lat, long);
        }
    });
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            game.setPosition(pos.coords.latitude,pos.coords.longitude);
        });
    }
    document.getElementById("mobile-switch").addEventListener("change", (e) => {
        let powerControls = document.querySelector(".power-controls");
        let directionControls = document.querySelector(".direction-controls");
        if(e.target.checked) {
            powerControls.style.display = "block";
            directionControls.style.display = "flex";
        } else {
            powerControls.style.display = "none";
            directionControls.style.display = "none";
        }
    });
};