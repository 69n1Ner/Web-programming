function showErrMessage(elem, html) {
    let message = document.createElement('div');
    message.classList.add("input-error");


    message.innerText = html;
    elem.append(message);


    const resizeErrMessage = () => {
        const coords = elem.getBoundingClientRect();
        message.style.left = (window.scrollX + coords.left + (elem.offsetWidth - message.offsetWidth) / 2) + "px";
        message.style.top = (window.scrollY + coords.bottom + 10) + "px";
    };
    resizeErrMessage();
    window.addEventListener('resize', resizeErrMessage);

    setTimeout(() => {
        window.removeEventListener('resize', resizeErrMessage);
        message.remove();
    }, 3000);
}

class EmptyError extends Error {
    constructor(target) {
        let itemName = "undefined object";

        if (typeof target === 'string') {
            itemName = target;
        } else if (target && typeof target === 'object' && target.name) {
            itemName = target.name;
        }

        super(`${itemName} is empty`);
        this.name = "EmptyError";
    }
}

class DefinitionError extends Error {
    constructor(target) {
        super(`${target} is outside definition`);
        this.name = "DefinitionError";
    }
}

class Point {
    constructor(x, y, r, time = new Date().toISOString()) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.time = time;
    }

    equalsXY(other) {
        if (other instanceof Point) {
            return this.x === other.x && this.y === other.y;

        } else throw new TypeError(`${other} must be a Point`);
    }

    isHit(r = this.r) {
        const x = this.x;
        const y = this.y;
        if (x >= 0 && y >= 0) {
            return x + y <= r;
        }
        if (x <= 0 && y <= 0) {
            return x >= -r && y >= -r;
        }
        if (x >= 0 && y <= 0) {
            return x * x + y * y <= (r / 2) * (r / 2);
        }
        return false;
    }

}

class Canvas {
    constructor(canvas) {
        this.SIZE = canvas.width;
        this.CENTER = this.SIZE / 2;
        this.scale = this.SIZE / 7;
        this.R = this.loadR();
        this.points_pool = this.loadPoints();
        this.table = new ResultTable(this.points_pool);
        this.redraw(canvas, this.R, this.points_pool);

        const form = document.querySelector('form');
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const strX = document.getElementById("data-x").value;
            const listY = Array.from(document.querySelectorAll("input[name='data-y']:checked")).map(chbx => chbx.value);
            const strR = document.getElementById("data-r").value;

            this.validate(strR, strX, listY)
                .then(data => this.createPoints(...data))
                .then(([points, r]) => {
                    this.table.addPoints(points);
                    this.redraw(canvas, r, this.points_pool);
                })
                .catch(error => {
                    console.error(error);
                });
        });
        document.getElementById("data-r").addEventListener("change", (e) => {
            this.saveR(+e.target.value);
            this.redraw(canvas, this.R, this.points_pool);
        });

        this.buttonRgbShadow(0, document.querySelector(".rgb-box"));
    }

    buttonRgbShadow(angle, button) {
        angle = angle === 360 ? 0 : angle + 7;
        setTimeout(() => {
            button.style.boxShadow = `1px 1px hsl(${angle} 100% 50%)`;
            this.buttonRgbShadow(angle, button);
        }, 150);
    }

    drawCanvas(canvas, r) {
        const ctx = canvas.getContext("2d");
        const SIZE = this.SIZE;
        const CENTER = this.CENTER;
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "black";

        ctx.save();
        // figures
        ctx.fillStyle = "#3399ff";

        ctx.beginPath();
        ctx.moveTo(this.toXPix(0), this.toYPix(0));
        ctx.lineTo(this.toXPix(r), this.toYPix(0));
        ctx.lineTo(this.toXPix(0), this.toYPix(r));
        ctx.closePath();
        ctx.fill();

        ctx.fillRect(this.toXPix(-r), this.toYPix(0), r * this.scale, r * this.scale);

        ctx.beginPath();
        ctx.moveTo(this.toXPix(0), this.toYPix(0));
        ctx.arc(this.toXPix(0), this.toYPix(0), (r / 2) * this.scale, 0, Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        //background lines
        ctx.restore();
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(0, CENTER);
        ctx.lineTo(SIZE, CENTER);
        ctx.moveTo(CENTER, SIZE);
        ctx.lineTo(CENTER, 0);
        ctx.stroke();
        //x arrow
        ctx.beginPath();
        ctx.moveTo(SIZE, CENTER);
        ctx.lineTo(SIZE - 8, CENTER - 4);
        ctx.moveTo(SIZE, CENTER);
        ctx.lineTo(SIZE - 8, CENTER + 4);
        ctx.stroke();
        //y arrow
        ctx.beginPath();
        ctx.moveTo(CENTER, 0);
        ctx.lineTo(CENTER - 4, 8);
        ctx.moveTo(CENTER, 0);

        ctx.lineTo(CENTER + 4, 8);
        ctx.stroke();

        //bc letters
        ctx.fillText("x", SIZE - 14, CENTER - 10);
        ctx.fillText("y", CENTER + 10, 14);

        const marks = [
            [r, "R"],
            [r / 2, "R/2"],
            [-r / 2, "-R/2"],
            [-r, "-R"],
        ];

        ctx.save();
        //bc ticks x
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        for (const [value, label] of marks) {
            const x = this.toXPix(value);
            ctx.beginPath();
            ctx.moveTo(x, CENTER - 4);
            ctx.lineTo(x, CENTER + 4);
            ctx.stroke();
            ctx.fillText(label, x, CENTER - 8);
        }

        //bc ticks y
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (const [value, label] of marks) {
            const y = this.toYPix(value);
            ctx.beginPath();
            ctx.moveTo(CENTER - 4, y);
            ctx.lineTo(CENTER + 4, y);
            ctx.stroke();
            ctx.fillText(label, CENTER + 8, y);
        }

        ctx.restore();
    }


    toXPix(x) {
        return this.CENTER + x * this.scale;
    }

    toYPix(y) {
        return this.CENTER - y * this.scale;
    }

    drawPoints(canvas, points, r) {
        if (this.validatePoints(points)) {
            let uniquePoints = this.getUniquePoints(points);
            const ctx = canvas.getContext("2d");
            for (let point of uniquePoints) {

                ctx.beginPath();
                ctx.arc(this.toXPix(point.x), this.toYPix(point.y), 3, 0, Math.PI * 2);
                if (point.isHit(r)) {
                    ctx.fillStyle = "red";
                } else {
                    ctx.fillStyle = "black";
                }
                ctx.fill();
            }
        }
    }

    getUniquePoints(points) {
        let filtered = [];
        for (let point of points) {
            if (!filtered.some(p => p.equalsXY(point))) {
                filtered.push(point);
            }
        }
        return filtered;
    }

    validatePoints(points) {
        if (!Array.isArray(points)) {
            throw new TypeError("Points must be an array");
        }

        for (let i = 0; i < points.length - 1; i++) {
            if (!(points[i] instanceof Point)) {
                throw new TypeError(
                    `Element at index ${i} must be an instance of Point`,
                );
            }
        }

        return true;
    }

    async createPoints(x, listY, r) {
        let point;
        let points = [];
        for (let y of listY) {
            point = new Point(x, y, r);
            points.push(point);
        }

        this.points_pool.push(...points);
        this.savePoints();
        return [points, r];
    }

    redraw(canvas, r, points) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, this.SIZE, this.SIZE);
        this.drawCanvas(canvas, r);
        this.drawPoints(canvas, points, r);
        return points;
    }


    async validate(strR, strX = "0", listY = [0]) {
        const Y_VALUES = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
        let x;
        let errStr = '';
        let fieldSet = document.getElementById("data-y");
        if (listY.length !== 0) {

            listY = listY.map(y => +y);
            for (let y of listY) {
                if (!Y_VALUES.includes(y)) {
                    errStr += `${y} is outside the definition`;
                    showErrMessage(fieldSet, errStr);
                    throw new TypeError(errStr);
                }
            }


            fieldSet = document.querySelector("form label");
            if (typeof strX === "string") {
                if (Number.isFinite(Number(strX)) && strX !== "") {
                    x = +strX;
                    if (-5 > x || x > 5) {
                        errStr = `x=${x} is outside the definition`;
                        showErrMessage(fieldSet, errStr);
                        throw new TypeError(errStr);
                    }

                } else {
                    errStr = `x=${strX} cannot be converted to number`;
                    showErrMessage(fieldSet, errStr);
                    throw new TypeError(errStr);
                }

            } else {
                errStr = `x=${strX} must be a string`;
                showErrMessage(fieldSet, errStr);
                throw new TypeError(errStr);
            }

            strR = this.parseR(strR);

            return [x, listY, strR];

        } else {
            showErrMessage(fieldSet, "At least one option must be chosen");
            throw new EmptyError("listY");
        }
    }

    parseR(strR) {
        if (Number.isFinite(Number(strR)) && strR !== "") {
            strR = +strR;
            const R_VALUES = [1, 1.5, 2, 2.5, 3];
            let errStr = '';
            if (!R_VALUES.includes(strR)) {
                errStr += `${strR} is outside the definition`;
                showErrMessage(document.getElementById("data-r"), errStr);
                throw new DefinitionError(strR);
            }
            return strR;
        } else throw new TypeError(`${strR} is not a number`);

    }

    saveR(r) {
        try {
            this.R = this.parseR(r);
            localStorage.setItem("r", JSON.stringify(r));
        } catch (e) {
            if (!(e instanceof TypeError)) console.error("Unable to save", e);
        }
    }

    savePoints() {
        try {
            localStorage.setItem("points-1", JSON.stringify(this.points_pool));
        } catch (e) {
            console.error("Unable to save", e);
        }
    }

    loadR() {
        const raw = localStorage.getItem("r");
        try {
            if (raw === null) {
                return 1;
            }
            const r = this.parseR(raw);
            document.getElementById("data-r").value = r;

            return r;

        } catch (error) {
            console.error(error);
            return 1;
        }
    }

    loadPoints() {
        try {
            const raw = localStorage.getItem("points-1");
            if (raw === null) {
                return [];
            }
            const data = JSON.parse(raw);
            if (!Array.isArray(data)) {
                return [];
            }
            return data
                .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.r))
                .map(p => new Point(p.x, p.y, p.r, p.time));
        } catch (error) {
            console.error(error);
            return [];
        }
    }

}

class ResultTable {
    constructor(points) {
        this.tbody = document.querySelector("#result-table tbody");
        points.forEach(p => this.addPoint(p));
    }

    addPoint(point) {
        const row = document.createElement("tr");
        const pointData = [
            point.x,
            point.y,
            point.r,
            null,
            new Date(point.time).toLocaleString("ru-RU"),
        ];

        for (let value of pointData) {
            let td = document.createElement("td");
            if (value !== null) {
                td.innerText = value;
            }
            row.append(td);
        }
        row.querySelector("td:nth-child(4)").classList.add(point.isHit() ? "hit" : "miss");
        this.tbody.prepend(row);
    };

    addPoints(points) {
        for (const point of points) {
            this.addPoint(point);
        }
    }
}

new Canvas(document.getElementById("graphic"));



