const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- SYSTEM TOOLTIPÓW ---
const tooltip = document.getElementById('tooltip');
function showTooltip(e, content) {
    tooltip.style.display = 'block';
    tooltip.innerHTML = content;
    tooltip.style.left = (e.pageX + 15) + 'px';
    tooltip.style.top = (e.pageY + 15) + 'px';
}
function hideTooltip() { tooltip.style.display = 'none'; }

// --- STAN GRY ---
let inventory = [], equipped = {}, enemies = [], groundItems = [], projectiles = [], particles = [];
let isMouseDown = false, moveTarget = null, mousePos = {x:0, y:0}, draggedItem = null;
let wave = 1, gold = 0, passivePoints = 1;

const player = { 
    x: 400, y: 225, hp: 100, maxHp: 100, mana: 100, maxMana: 100, 
    baseDmg: 15, lvl: 1, xp: 0, xpToNext: 100, speed: 3.5
};

// --- WALKA I PRZECIWNICY ---
function spawnWave() {
    for(let i = 0; i < 3 + wave; i++) {
        const side = Math.random() > 0.5;
        enemies.push({
            x: side ? Math.random() * 800 : (Math.random() > 0.5 ? -20 : 820),
            y: !side ? Math.random() * 450 : (Math.random() > 0.5 ? -20 : 470),
            hp: 40 + (wave * 12),
            maxHp: 40 + (wave * 12),
            type: Math.random() > 0.75 ? 'range' : 'melee',
            speed: 1.1 + (Math.random() * 0.4),
            lastShot: 0
        });
    }
    wave++;
    document.getElementById('waveInfo').innerText = wave;
}

function singleAttack() {
    const ang = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);
    particles.push({x: player.x, y: player.y, r: 10, maxR: 70, alpha: 1, color: '#fff', type: 'cone', angle: ang});
    enemies.forEach(en => {
        if (Math.hypot(en.x - player.x, en.y - player.y) < 85) {
            en.hp -= player.baseDmg;
            createHitParticle(en.x, en.y, '#e74c3c');
        }
    });
}

function createHitParticle(x, y, color) {
    for(let i=0; i<3; i++) {
        particles.push({x, y, r: 2, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, alpha: 1, color, type: 'spark'});
    }
}

// --- LOGIKA GRY (UPDATE) ---
function update() {
    if (moveTarget) {
        const d = Math.hypot(moveTarget.x - player.x, moveTarget.y - player.y);
        if (d > 5) {
            player.x += (moveTarget.x - player.x)/d * player.speed;
            player.y += (moveTarget.y - player.y)/d * player.speed;
        } else { moveTarget = null; }
    }

    enemies.forEach((e, idx) => {
        const d = Math.hypot(player.x - e.x, player.y - e.y);
        if (d < 180) {
            if (e.type === 'melee') {
                e.x += (player.x - e.x)/d * e.speed; e.y += (player.y - e.y)/d * e.speed;
                if (d < 18) player.hp -= 0.3;
            } else if (d > 120) {
                e.x += (player.x - e.x)/d * e.speed; e.y += (player.y - e.y)/d * e.speed;
            }
        }
        if (e.hp <= 0) { dropLoot(e.x, e.y); player.xp += 35; enemies.splice(idx, 1); if (enemies.length === 0) setTimeout(spawnWave, 1000); }
    });

    if (player.xp >= player.xpToNext) { player.lvl++; player.xp = 0; player.xpToNext *= 1.2; passivePoints++; player.hp = player.maxHp; }
    if (player.hp <= 0) { alert("Zginąłeś!"); location.reload(); }

    particles.forEach((p, i) => {
        if (p.type === 'spark') { p.x += p.vx; p.y += p.vy; p.alpha -= 0.02; }
        else { p.r += 3; p.alpha -= 0.04; }
        if(p.alpha <= 0) particles.splice(i, 1);
    });
    updateUI();
}

// --- RYSOWANIE (DRAW) ---
function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 800, 450);

    groundItems.forEach(item => {
        ctx.fillStyle = item.color || item.rarity.c;
        ctx.fillText(item.name, item.x, item.y - 15);
    });

    enemies.forEach(e => {
        ctx.fillStyle = e.type === 'range' ? '#4a90e2' : '#e74c3c';
        ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI*2); ctx.fill();
    });

    ctx.fillStyle = "#f1c40f";
    ctx.beginPath(); ctx.arc(player.x, player.y, 12, 0, Math.PI*2); ctx.fill();

    particles.forEach(p => {
        ctx.strokeStyle = p.color; ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        if(p.type === 'cone') ctx.arc(p.x, p.y, p.r, p.angle-0.6, p.angle+0.6);
        else if(p.type === 'circle') ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.stroke(); ctx.globalAlpha = 1;
    });
}

function updateUI() {
    document.getElementById('hp-fill').style.width = (player.hp / player.maxHp * 100) + "%";
    document.getElementById('hp-val').innerText = Math.ceil(player.hp);
    document.getElementById('playerLvl').innerText = player.lvl;
    document.getElementById('passPoints').innerText = passivePoints;
    document.getElementById('playerGold').innerText = gold;
}

// --- EKWIPIUNEK I ŁUP ---
function renderInventory() {
    const grid = document.getElementById('invGrid');
    grid.innerHTML = "";
    for (let i = 0; i < 20; i++) {
        const slot = document.createElement('div');
        slot.className = "inv-slot";
        const item = inventory[i];
        if (item) {
            const el = document.createElement('div');
            el.className = "item"; el.style.color = item.color || item.rarity.c;
            el.innerHTML = item.icon || "⚔️"; el.draggable = true;
            el.onmouseenter = (e) => showTooltip(e, `<b>${item.name}</b>`);
            el.onmouseleave = hideTooltip;
            el.ondragstart = () => { draggedItem = { item, idx: i, fromSlot: false }; };
            slot.appendChild(el);
        }
        grid.appendChild(slot);
    }
}

function dropLoot(x, y) {
    if (Math.random() > 0.7) {
        groundItems.push({x, y, name: "Miecz", type: "WEAPON", rarity: {n:"Normal", c:"#fff"}});
    }
}

// --- DRZEWKO PASYWNE ---
const treeCont = document.getElementById('tree-container');
const nodes = [];
function initPassiveTree() {
    for (let i = 0; i < 50; i++) {
        const x = 2000 + Math.cos(i * 0.5) * (100 + i * 20);
        const y = 2000 + Math.sin(i * 0.5) * (100 + i * 20);
        const node = { id: i, x, y, active: i === 0, type: "DMG", val: 5 };
        nodes.push(node);
        const el = document.createElement('div');
        el.className = `node ${node.active ? 'active' : ''}`;
        el.style.left = x + 'px'; el.style.top = y + 'px';
        el.onclick = () => {
            if (passivePoints > 0 && !node.active) {
                node.active = true; passivePoints--; player.baseDmg += node.val;
                el.classList.add('active'); updateUI();
            }
        };
        treeCont.appendChild(el);
    }
}

// --- STEROWANIE ---
window.onkeydown = e => {
    if (e.key.toLowerCase() === 'i') { 
        const p = document.getElementById('character-panel');
        p.style.display = p.style.display === 'block' ? 'none' : 'block';
    }
    if (e.key.toLowerCase() === 'p') {
        const p = document.getElementById('passive-panel');
        p.style.display = p.style.display === 'block' ? 'none' : 'block';
    }
    if (e.key === ' ') singleAttack();
};

canvas.onmousedown = e => {
    const r = canvas.getBoundingClientRect();
    moveTarget = {x: e.clientX - r.left, y: e.clientY - r.top};
};

// --- START ---
initPassiveTree();
spawnWave();
renderInventory();
setInterval(() => { update(); draw(); }, 16);
