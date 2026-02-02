const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- SYSTEM TOOLTIPÓW (Kluczowy, by gra nie wyrzucała błędu) ---
const tooltip = document.getElementById('tooltip');
function showTooltip(e, content) {
    tooltip.style.display = 'block';
    tooltip.innerHTML = content;
    tooltip.style.left = (e.pageX + 15) + 'px';
    tooltip.style.top = (e.pageY + 15) + 'px';
}
function hideTooltip() { tooltip.style.display = 'none'; }

// ... TUTAJ WKLEJ CAŁĄ RESZTĘ KODU: zmienne (player, inventory), 
// funkcje (update, draw, spawnWave, initPassiveTree) ...

// NA SAMYM DOLE PLIKU DODAJ TE LINIE STARTOWE:
initPassiveTree(); 
spawnWave(); 
renderInventory();
setInterval(() => { update(); draw(); }, 16);
