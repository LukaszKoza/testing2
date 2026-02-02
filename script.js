const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // --- STAN GRY ---
    let inventory = [], equipped = {}, enemies = [], groundItems = [], projectiles = [], particles = [];
    let isMouseDown = false, moveTarget = null, mousePos = {x:0, y:0}, draggedItem = null;
    let wave = 1, gold = 0, passivePoints = 1;

    const player = { 
        x: 400, y: 225, hp: 100, maxHp: 100, mana: 100, maxMana: 100, 
        baseDmg: 20, lvl: 1, xp: 0, xpToNext: 100, speed: 3.5
    };

    // --- SYSTEM TOOLTIPÓW ---
    const tooltip = document.getElementById('tooltip');
    function showTooltip(e, content) {
        tooltip.style.display = 'block';
        tooltip.innerHTML = content;
        tooltip.style.left = (e.pageX + 15) + 'px';
        tooltip.style.top = (e.pageY + 15) + 'px';
    }
    function hideTooltip() { tooltip.style.display = 'none'; }

    // --- DRZEWKO PASYWNE (Z PRZESUWANIEM) ---
    const treeCont = document.getElementById('tree-container');
    const nodes = [];
    let isPanning = false, panX = -1500, panY = -1500, startX, startY;

    document.getElementById('passive-panel').onmousedown = (e) => {
        if(e.target.classList.contains('node')) return;
        isPanning = true; startX = e.clientX - panX; startY = e.clientY - panY;
    };
    
    function initPassiveTree() {
        treeCont.innerHTML = "";
        for (let i = 0; i < 70; i++) {
            const angle = i * 0.45;
            const dist = 100 + (i * 22);
            const x = 2000 + Math.cos(angle) * dist;
            const y = 2000 + Math.sin(angle) * dist;
            const node = { id: i, x, y, active: i === 0, type: i % 4 === 0 ? "DMG" : "HP", val: 5 + (i % 5), conns: [] };
            nodes.push(node);
        }
        nodes.forEach((n, i) => {
            if (i < nodes.length - 1) { n.conns.push(i + 1); createConnector(n, nodes[i+1]); }
            createNodeEl(n);
        });
        updateConnectors();
    }

    function createNodeEl(node) {
        const el = document.createElement('div');
        el.className = `node ${node.active ? 'active' : ''}`;
        el.style.left = node.x + 'px'; el.style.top = node.y + 'px';
        el.onmouseenter = (e) => showTooltip(e, `<b>${node.type === "DMG" ? "Atak" : "Życie"}</b><br>Daje: +${node.val}`);
        el.onmouseleave = hideTooltip;
        el.onclick = () => {
            const canConnect = nodes.some(n => n.active && (n.conns.includes(node.id) || node.id === n.id + 1));
            if (passivePoints > 0 && !node.active && canConnect) {
                node.active = true; passivePoints--;
                if (node.type === "DMG") player.baseDmg += node.val;
                else { player.maxHp += node.val; player.hp += node.val; }
                updateUI(); el.classList.add('active'); updateConnectors();
            }
        };
        treeCont.appendChild(el);
    }

    function createConnector(n1, n2) {
        const conn = document.createElement('div');
        conn.className = 'connector';
        const dist = Math.hypot(n2.x - n1.x, n2.y - n1.y);
        const ang = Math.atan2(n2.y - n1.y, n2.x - n1.x);
        conn.style.width = dist + 'px'; conn.style.left = (n1.x + 17) + 'px'; conn.style.top = (n1.y + 17) + 'px';
        conn.style.transform = `rotate(${ang}rad)`;
        conn.id = `conn-${Math.min(n1.id, n2.id)}-${Math.max(n1.id, n2.id)}`;
        treeCont.appendChild(conn);
    }

    function updateConnectors() {
        nodes.forEach(n => n.conns.forEach(tid => {
            const c = document.getElementById(`conn-${Math.min(n.id, tid)}-${Math.max(n.id, tid)}`);
            if (c && n.active && nodes[tid] && nodes[tid].active) c.classList.add('active');
        }));
    }

    // --- SYSTEM EQ I LOOTU ---
    function renderInventory() {
        const grid = document.getElementById('invGrid');
        grid.innerHTML = "";
        for (let i = 0; i < 20; i++) {
            const slot = document.createElement('div'); slot.className = "inv-slot";
            const item = inventory[i];
            if (item) {
                const el = document.createElement('div'); el.className = "item";
                el.style.color = item.color || (item.rarity ? item.rarity.c : "#fff");
                el.innerHTML = item.icon || "⚔️"; el.draggable = true;
                el.onmouseenter = (e) => showTooltip(e, `<b>${item.name}</b>`);
                el.onmouseleave = hideTooltip;
                el.ondragstart = () => { draggedItem = { item, idx: i, fromSlot: false }; };
                slot.appendChild(el);
            }
            slot.ondragover = e => e.preventDefault();
            slot.ondrop = () => { if (draggedItem && draggedItem.item.isCurrency && item) applyCurrency(draggedItem.item, item, i); };
            grid.appendChild(slot);
        }
        document.querySelectorAll('.slot').forEach(slot => {
            const type = slot.dataset.type;
            const eqItem = equipped[type];
            slot.innerHTML = eqItem ? "" : `<small>${type}</small>`;
            if (eqItem) {
                const el = document.createElement('div'); el.className = "item"; el.style.color = eqItem.rarity.c;
                el.innerHTML = "🛡️"; el.draggable = true;
                el.ondragstart = () => { draggedItem = { item: eqItem, type, fromSlot: true }; };
                slot.appendChild(el);
            }
            slot.ondragover = e => e.preventDefault();
            slot.ondrop = () => {
                if (draggedItem && !draggedItem.fromSlot && draggedItem.item.type === type) {
                    if (equipped[type]) inventory.push(equipped[type]);
                    equipped[type] = draggedItem.item; inventory.splice(draggedItem.idx, 1); renderInventory();
                }
            };
        });
    }

    function applyCurrency(orb, target, idx) {
        if (orb.name === "Chaos Orb") {
            target.rarity = {n: "Rare", c: "#f1c40f"};
            target.name = "Rare " + target.type;
        }
        inventory.splice(draggedItem.idx, 1); renderInventory();
    }

    function dropLoot(x, y) {
        if (Math.random() < 0.2) {
            groundItems.push({x, y, name: "Chaos Orb", isCurrency: true, color: "#d2ad7c", icon: "●"});
        } else if (Math.random() > 0.7) {
            const types = ["WEAPON", "HELM", "ARMOR", "SHIELD", "BOOTS"];
            const t = types[Math.floor(Math.random()*types.length)];
            groundItems.push({x, y, type: t, name: t, rarity: {n:"Normal", c:"#fff"}});
        }
    }

    // --- WALKA I SILNIK ---
    function spawnWave() {
        for(let i=0; i<3+wave; i++) enemies.push({x: Math.random()*800, y: Math.random()*450, hp: 50+wave*5, maxHp: 50+wave*5, type: Math.random()>0.8?'range':'melee', speed: 1.2, lastShot: 0});
        wave++; document.getElementById('waveInfo').innerText = wave;
    }

    function update() {
        if (moveTarget) {
            const d = Math.hypot(moveTarget.x - player.x, moveTarget.y - player.y);
            if (d > 5) { player.x += (moveTarget.x - player.x)/d * player.speed; player.y += (moveTarget.y - player.y)/d * player.speed; }
        }
        enemies.forEach((e, idx) => {
            const d = Math.hypot(player.x - e.x, player.y - e.y);
            if (d < 250) {
                e.x += (player.x - e.x)/d * e.speed; e.y += (player.y - e.y)/d * e.speed;
                if (d < 15) player.hp -= 0.4;
            }
            if (e.hp <= 0) { dropLoot(e.x, e.y); player.xp += 40; enemies.splice(idx, 1); if(enemies.length === 0) spawnWave(); }
        });
        if (player.xp >= player.xpToNext) { player.lvl++; player.xp = 0; passivePoints++; player.hp = player.maxHp; updateUI(); }
        if (player.hp <= 0) { player.hp = player.maxHp; player.x = 400; player.y = 225; }
        particles.forEach((p, i) => { p.r += 4; p.alpha -= 0.05; if(p.alpha <= 0) particles.splice(i, 1); });
        updateUI();
    }

    function draw() {
        ctx.fillStyle = "#000"; ctx.fillRect(0,0,800,450);
        groundItems.forEach(item => {
            ctx.fillStyle = item.color || (item.rarity ? item.rarity.c : "#fff");
            ctx.fillText(item.name, item.x-20, item.y-10);
        });
        enemies.forEach(e => {
            ctx.fillStyle = e.type === 'range' ? '#4a90e2' : '#e74c3c';
            ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI*2); ctx.fill();
        });
        particles.forEach(p => {
            ctx.strokeStyle = `rgba(255,255,255,${p.alpha})`; ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.stroke();
        });
        ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(player.x, player.y, 12, 0, Math.PI*2); ctx.fill();
    }

    function updateUI() {
        document.getElementById('hp-fill').style.width = (player.hp/player.maxHp*100) + "%";
        document.getElementById('hp-val').innerText = Math.ceil(player.hp);
        document.getElementById('hp-max').innerText = player.maxHp;
        document.getElementById('mp-val').innerText = Math.ceil(player.mana);
        document.getElementById('passPoints').innerText = passivePoints;
        document.getElementById('playerLvl').innerText = player.lvl;
        document.getElementById('xp-fill').style.width = (player.xp/player.xpToNext*100) + "%";
        document.getElementById('playerGold').innerText = gold;
    }

    // --- OBSŁUGA WEJŚĆ ---
    window.onmousemove = (e) => {
        if (isPanning) { panX = e.clientX - startX; panY = e.clientY - startY; treeCont.style.transform = `translate(${panX}px, ${panY}px)`; }
        const r = canvas.getBoundingClientRect(); mousePos = {x: e.clientX - r.left, y: e.clientY - r.top};
        if (isMouseDown) moveTarget = { ...mousePos };
    };
    window.onmouseup = () => { isPanning = false; isMouseDown = false; };
    
    window.onkeydown = e => {
        const k = e.key.toLowerCase();
        if (k === '1') player.hp = Math.min(player.maxHp, player.hp + 40);
        if (k === '2') player.mana = Math.min(player.maxMana, player.mana + 40);
        if (k === 'i') document.getElementById('character-panel').style.display = document.getElementById('character-panel').style.display === 'block' ? 'none' : 'block';
        if (k === 'p') document.getElementById('passive-panel').style.display = document.getElementById('passive-panel').style.display === 'block' ? 'none' : 'block';
        if (k === ' ') {
            particles.push({x: player.x, y: player.y, r: 5, alpha: 1});
            enemies.forEach(en => { if (Math.hypot(en.x - player.x, en.y - player.y) < 80) en.hp -= player.baseDmg; });
        }
    };

    canvas.onmousedown = e => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const itemIdx = groundItems.findIndex(i => Math.hypot(mx-i.x, my-i.y) < 30);
        if (itemIdx > -1) {
            if (inventory.length < 20) { inventory.push(groundItems[itemIdx]); groundItems.splice(itemIdx, 1); renderInventory(); }
        } else { moveTarget = {x: mx, y: my}; isMouseDown = true; }
    };

    document.getElementById('sell-zone').ondragover = e => e.preventDefault();
    document.getElementById('sell-zone').ondrop = () => {
        gold += 25; if(draggedItem.fromSlot) delete equipped[draggedItem.type]; else inventory.splice(draggedItem.idx, 1);
        renderInventory(); updateUI();
    };

    // --- START ---
    initPassiveTree(); spawnWave(); renderInventory();
    setInterval(() => { update(); draw(); }, 16);