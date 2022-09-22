'use strict'

let countP = document.getElementById("count");

let canvas = document.getElementsByTagName("canvas")[0];
let ctx    = canvas.getContext("2d");

let Simulation = (() =>
{
    class Grid extends Array
    {
        constructor (w, h)
        {
            super(w * h);
            this.w = w - 1;

            for (let i = 0; i < this.length; i++)
            {
                this[i] = {
                    particles: new Array(10),
                    count: 0
                };
            }
        }

        clear ()
        {
            for (let i = 0; i < this.length; i++)
            {
                this[i].count = 0;
            }
        }

        at (x, y)
        {
            return this[y * this.w + x];
        }
    }

    let RADIUS = 15,
        DIAMETER = RADIUS + RADIUS,
        DIAMETER2 = DIAMETER * DIAMETER,
        INV_DIAMETER = 1 / DIAMETER;

    let DENSITY = 2,
        PRESSURE = 2,
        VISCOSITY = 0.1;

    let MAX_PARTICLES = 4048;
    let MAX_CONTACTS  = MAX_PARTICLES * 10;

    let position_x = new Array(MAX_PARTICLES);
    let position_y = new Array(MAX_PARTICLES);
    let velocity_x = new Array(MAX_PARTICLES);
    let velocity_y = new Array(MAX_PARTICLES);
    let force_x    = new Array(MAX_PARTICLES);
    let force_y    = new Array(MAX_PARTICLES);
    let density    = new Array(MAX_PARTICLES);
    let contacts   = new Array(MAX_CONTACTS)

    for (let i = 0; i < MAX_PARTICLES; i++)
    {
        position_x[i] = 0.0;
        position_y[i] = 0.0;
        velocity_x[i] = 0.0;
        velocity_y[i] = 0.0;
        force_x[i]    = 0.0;
        force_y[i]    = 0.0;
        density[i]    = 0.0;
    }

    for (let i = 0; i < MAX_CONTACTS; i++)
    {
        contacts[i] = {
            a: 0,
            b: 0,
            distance: 0,
            weight: 0,
            normal_x: 0.0,
            normal_y: 0.0
        };
    }

    let particlesNum = 0;
    let contactsNum  = 0;

    let width  = (canvas.clientWidth  / DIAMETER) | 0;
    let height = (canvas.clientHeight / DIAMETER) | 0;

    let grid = new Grid(width, height);   

    function addContact (a, b, distance, nx, ny)
    {
        if (contactsNum < MAX_CONTACTS)
        {
            let c = contacts[contactsNum++];
            c.a = a;
            c.b = b;
            c.distance = distance;
            c.weight = 1 - distance / DIAMETER;
            let dens = c.weight * c.weight;
            dens += dens * c.weight;
            density[a] += dens;
            density[b] += dens;
            c.normal_x = nx;
            c.normal_y = ny;
        }
    }

    function integrate ()
    {
        for (let i = 0; i < particlesNum; i++)
        {
            if (density[i] > 0.0001)
            {
                velocity_x[i] += force_x[i] / density[i];
                velocity_y[i] += force_y[i] / density[i];
            }

            position_x[i] += velocity_x[i];
            position_y[i] += velocity_y[i];
            force_x[i] = 0.0;
            force_y[i] = 0.0;
            density[i] = 0;
        }
    }

    function clearGrid ()
    {
        grid.clear();
    }

    function findContacts ()
    {
        contactsNum = 0;

        for (let i = 0; i < particlesNum; i++)
        {
            let gx = position_x[i] / DIAMETER | 0;
            let gy = position_y[i] / DIAMETER | 0;

            if (gx < 0)
            {
                gx = 0;
            }

            if (gy < 0)
            {
                gy = 0;
            }

            if (gx >= width)
            {
                gx = width - 1;
            }

            if (gy >= height)
            {
                gy = height - 1;
            }

            let minx = gx !== 0;
            let miny = gy !== 0;
            let maxx = gx !== width - 1;
            let maxy = gy !== height - 1;

            if (minx)
            {
                let g = grid.at(gx - 1, gy);
                findNeighbours(i, g);
            }

            if (maxx)
            {
                let g = grid.at(gx + 1, gy);
                findNeighbours(i, g);
            }
			
            if (miny)
            {
                let g = grid.at(gx, gy - 1);
                findNeighbours(i, g);
            }

            if (maxy)
            {
                let g = grid.at(gx, gy + 1);
                findNeighbours(i, g);
            }
			
            if (minx && miny)
            {
                let g = grid.at(gx - 1, gy - 1);
                findNeighbours(i, g);
            }
			
            if (minx && maxy)
            {
                let g = grid.at(gx - 1, gy + 1);
                findNeighbours(i, g);
            }
            
            if (maxx && miny)
            {
                let g = grid.at(gx + 1, gy - 1);
                findNeighbours(i, g);
            }
			
            if (maxx && maxy)
            {
                let g = grid.at(gx + 1, gy + 1);
                findNeighbours(i, g);
            }

            let g = grid.at(gx, gy);
            findNeighbours(i, g);

            g.particles[g.count++] = i;
        }
    }

    function findNeighbours (i, g)
    {
        for (let j = 0; j < g.count; j++)
        {
            let j_id = g.particles[j];
            let dx = position_x[i] - position_x[j_id];
            let dy = position_y[i] - position_y[j_id];
            let distSq = dx * dx + dy * dy;

            if (distSq < DIAMETER2)
            {
                let dist = Math.sqrt(distSq);
                addContact(i, j_id, dist, dx / dist, dy / dist);
            }
        }
    }

    function contactsForce ()
    {
        for (let i = 0; i < contactsNum; i++)
        {
            let c = contacts[i];

            let pressureWeight = c.weight * (density[c.a] + density[c.b] - DENSITY) * PRESSURE;
            pressureWeight = Math.max(0, pressureWeight);

            let displacement_x = c.normal_x * pressureWeight;
            let displacement_y = c.normal_y * pressureWeight;

            force_x[c.a] += displacement_x;
            force_y[c.a] += displacement_y;
            force_x[c.b] -= displacement_x;
            force_y[c.b] -= displacement_y;

            let vx = velocity_x[c.b] - velocity_x[c.a];
            let vy = velocity_y[c.b] - velocity_y[c.a];

            let viscosityWeight = c.weight * VISCOSITY;
            vx *= viscosityWeight;
            vy *= viscosityWeight;

            force_x[c.a] += vx;
            force_y[c.a] += vy;
            force_x[c.b] -= vx;
            force_y[c.b] -= vy;
        }
    }

    function borderConstraint ()
    {
        for (let i = 0; i < particlesNum; i++)
        {
            let px = position_x[i];
            let py = position_y[i];

            if (px < RADIUS)
            {
                velocity_x[i] += (RADIUS - px) * 0.5 - velocity_x[i] * 0.5;
            }

            if (py < RADIUS)
            {
                velocity_y[i] += (RADIUS - py) * 0.5 - velocity_y[i] * 0.5;
            }

            if (px > canvas.clientWidth - RADIUS)
            {
                velocity_x[i] += (canvas.clientWidth - RADIUS - px) * 0.5 - velocity_x[i] * 0.5;
            }

            if (py > canvas.clientHeight - RADIUS)
            {
                velocity_y[i] += (canvas.clientHeight - RADIUS - py) * 0.5 - velocity_y[i] * 0.5;
            }
        }
    }

    function gravity ()
    {
        for (let i = 0; i < particlesNum; i++)
        {
            velocity_y[i] += 0.05;
        }
    }

    function update ()
    {
        clearGrid();
        gravity();
        findContacts();
        contactsForce();
        borderConstraint();
        integrate();
    }

    function addFluid (x, y)
    {
        if (particlesNum === MAX_PARTICLES)
        {
            return;
        }

        position_x[particlesNum] = x;
        position_y[particlesNum] = y;
        velocity_y[particlesNum] = 5;
        particlesNum++;
    }

    return {
        update: update,
        pour: function(x, y) {
            for (let i = -4; i <= 4; i++)
            {
                addFluid(x + i * 20, y);
            }
            countP.innerHTML = particlesNum;
        },
        setBorders: function(w, h) {
            width  = w;
            height = h;
        },
        getCount: function() {
            return particlesNum;
        },
        forEach: function(callback) {
            for (let i = 0; i < particlesNum; i++)
            {
                callback(position_x[i], position_y[i]);
            }
        },
        reset: function() {
            particlesNum = 0;
            contactsNum = 0;
			width  = (canvas.clientWidth  / DIAMETER) | 0;
            height = (canvas.clientHeight / DIAMETER) | 0;
			grid = new Grid(width, height);
        },
    };
})();

let mouse = {
    down: false,
    x: 0,
    y: 0
};

let pourTimer = 0;

update();

function update ()
{
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    pourTimer += 0.016;
    resize(canvas);

    if (mouse.down && pourTimer > 0.08)
    {
        pourTimer = 0;
        Simulation.pour(mouse.x, mouse.y);
    }

    Simulation.update();
    render();

    requestAnimationFrame(update);
}

function render ()
{
    ctx.fillStyle = 'rgb(150, 230, 240)';

    Simulation.forEach((x, y) =>
    {
        ctx.fillRect(x - 3, y - 3, 6, 6);
    });
}

function resize (canvas)
{
    let displayWidth  = canvas.clientWidth;
    let displayHeight = canvas.clientHeight;

    if (canvas.width  != displayWidth ||
        canvas.height != displayHeight)
    {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
        Simulation.reset();
        for (let i = 0; i < 80; i++) {
        	Simulation.pour(displayWidth * 0.5, displayHeight * 0.3 + 10 * i);
        }
    }
}

canvas.addEventListener("mousedown", (e) =>
{
    e.preventDefault();
    mouse.down = true;
    mouse.x = e.pageX;
    mouse.y = e.pageY;
});

canvas.addEventListener("mousemove", (e) =>
{
    mouse.x = e.pageX;
    mouse.y = e.pageY;
});

window.addEventListener("mouseup", (e) =>
{
    mouse.down = false;
});

canvas.addEventListener("touchstart", (e) =>
{
    e.preventDefault();
    mouse.down = true;
    mouse.x = e.pageX;
    mouse.y = e.pageY;
});

canvas.addEventListener("touchmove", (e) =>
{
    mouse.x = e.targetTouches[0].pageX;
    mouse.y = e.targetTouches[0].pageY;
});

canvas.addEventListener("touchend", (e) =>
{
    mouse.down = false;
});
