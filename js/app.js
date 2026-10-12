// --- ESTADO DEL SIMULADOR (MOTOR BANDERSNATCH) ---
let gameState = { 
    stage: 'start', // start, sample_added, washed_1, ab_added, incubated, washed_2, substrate_added
    noiseMultiplier: 0,
    fatalError: null
};

let config = {
    cutoff: (Math.random() * 0.1 + 0.25).toFixed(2), // Punto de corte entre 0.25 y 0.35
    errorScenario: 'none',
    patients: []
};
let wells = [];

// --- INICIALIZACIÓN ---
function initLab() {
    // Generar escenario aleatorio
    const rand = Math.random();
    if (rand < 0.15) config.errorScenario = 'pos_fail'; // 15% Control Positivo falla
    else if (rand < 0.30) config.errorScenario = 'neg_fail'; // 15% Control Negativo alto
    else if (rand < 0.50) config.errorScenario = 'wash_fail'; // 20% Lavado deficiente (ruido de fondo)
    
    // Generar pacientes (Min 3, Max 4)
    const numPatients = Math.random() > 0.5 ? 4 : 3;
    config.patients.push({ id: 'P1', isReactive: true, baseAbs: (Math.random() * 0.8 + 0.6) }); // Reactivo seguro
    config.patients.push({ id: 'P2', isReactive: false, baseAbs: (Math.random() * 0.1 + 0.05) }); // No reactivo seguro
    config.patients.push({ id: 'P3', isReactive: true, baseAbs: (Math.random() * 0.5 + 0.4) }); // Reactivo seguro
    if (numPatients === 4) {
        const isReact = Math.random() > 0.5;
        config.patients.push({ id: 'P4', isReactive: isReact, baseAbs: isReact ? (Math.random() * 0.8 + 0.5) : (Math.random() * 0.1 + 0.05) });
    }

    // Mezclar orden de pacientes
    config.patients = config.patients.sort(() => Math.random() - 0.5);

    // Construir Array de Pocillos
    wells.push({ id: 'Blanco', type: 'blank', val: 0.03, colorBase: 'bg-transparent', colorFinal: 'bg-transparent' });
    wells.push({ id: 'C(-)', type: 'control', val: 0.07, colorBase: 'bg-transparent', colorFinal: 'bg-transparent' });
    wells.push({ id: 'C(+)', type: 'control', val: 1.48, colorBase: 'bg-transparent', colorFinal: 'bg-blue-800' });
    
    config.patients.forEach(p => {
        wells.push({ 
            id: p.id, 
            type: 'patient', 
            val: p.baseAbs, 
            colorBase: 'bg-transparent', 
            colorFinal: p.isReactive ? 'bg-blue-700' : 'bg-transparent' 
        });
    });

    // Aplicar Errores a los valores teóricos
    if (config.errorScenario === 'pos_fail') {
        wells.find(w => w.id === 'C(+)').val = 0.08;
        wells.find(w => w.id === 'C(+)').colorFinal = 'bg-transparent';
    }
    if (config.errorScenario === 'neg_fail') {
        wells.find(w => w.id === 'C(-)').val = 1.25;
        wells.find(w => w.id === 'C(-)').colorFinal = 'bg-blue-600';
    }
    if (config.errorScenario === 'wash_fail') {
        // Aumenta el fondo de todos en ~0.40
        wells.forEach(w => {
            if(w.id !== 'Blanco') {
                w.val += (Math.random() * 0.2 + 0.3);
                if(w.val > 0.4 && w.colorFinal === 'bg-transparent') w.colorFinal = 'bg-blue-300';
            }
        });
    }

    renderPlate();
    logAction(`Sesión iniciada. Muestras preparadas: ${numPatients} pacientes.`);
    document.getElementById('run-config-info').innerHTML += `<li>Pacientes analizados: ${config.patients.map(p=>p.id).join(', ')}</li>`;
    updateChoices();
}

// --- RENDERIZADO VISUAL CON CAPAS MOLECULARES ---
function renderPlate() {
    const grid = document.getElementById('plate-grid');
    // Adaptación de columnas: 2 en móvil, 3 en pantallas pequeñas, 4 en grandes si hay más de 6 pocillos
    const cols = wells.length > 6 ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3';
    grid.className = `grid gap-3 sm:gap-6 ${cols}`;
    grid.innerHTML = '';

    wells.forEach((well, index) => {
        const el = document.createElement('div');
        el.className = 'flex flex-col items-center';
        
        // Selector de diluciones
        const dilutionHtml = well.type === 'patient' ? `
            <select id="dil-${index}" class="text-[10px] sm:text-xs border border-yellow-400 rounded mt-2 p-1 text-center bg-yellow-50 focus:ring-blue-500 animate-pulse w-full max-w-[80px]">
                <option value="1">1:2</option>
                <option value="0.5">1:10</option>
                <option value="0.1">1:100</option>
            </select>` : `<div class="h-6 sm:h-8 mt-2"></div>`;

        el.innerHTML = `
            <div id="well-${index}" class="well w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 sm:border-4 border-slate-300 bg-white shadow-inner relative overflow-hidden flex justify-center">
                <div id="liquid-${index}" class="absolute bottom-0 w-full h-0 bg-transparent transition-all duration-700 z-10"></div>
                <div class="molecular-layer ab-capture z-20 text-xl sm:text-3xl pb-0 sm:pb-1"><i class="fas fa-vial"></i></div>
                <div id="ag-${index}" class="molecular-layer antigen z-30 text-sm sm:text-base opacity-0"><i class="fas fa-circle"></i></div>
                <div id="ab-det-${index}" class="molecular-layer ab-detect z-40 text-xl sm:text-3xl opacity-0 relative">
                    <i class="fas fa-vial"></i>
                    <i class="fas fa-certificate enzyme text-[10px] sm:text-xs"></i>
                </div>
            </div>
            <span class="text-[10px] sm:text-sm font-extrabold mt-2 text-slate-800 bg-slate-200 px-1 sm:px-2 rounded text-center truncate w-full max-w-[80px]">${well.id}</span>
            ${dilutionHtml}
        `;
        grid.appendChild(el);
    });
}

// Motor de Decisiones (Bandersnatch)
function updateChoices() {
    const container = document.getElementById('controls-container');
    container.innerHTML = `<p class="text-sm font-bold text-red-600 mb-2">¿Qué reactivo o acción aplicará ahora?</p>`;
    
    const createBtn = (text, icon, action, color) => {
        const btn = document.createElement('button');
        btn.className = `w-full text-left p-3 ${color} rounded font-bold shadow transform hover:scale-105 transition flex items-center gap-2`;
        btn.innerHTML = `<i class="${icon}"></i> ${text}`;
        btn.onclick = action;
        return btn;
    };

    // Opciones disponibles permanentemente para forzar la decisión del usuario
    container.appendChild(createBtn('Añadir Muestra/Control', 'fas fa-eye-dropper', () => makeDecision('add_sample'), 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300'));
    container.appendChild(createBtn('Lavar Placa (PBS)', 'fas fa-shower', () => makeDecision('wash_1'), 'bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300'));
    container.appendChild(createBtn('Añadir Ac. Detección', 'fas fa-vial', () => makeDecision('add_ab'), 'bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300'));
    container.appendChild(createBtn('Incubar (37°C)', 'fas fa-thermometer-half', () => makeDecision('incubate'), 'bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300'));
    container.appendChild(createBtn('Añadir Sustrato', 'fas fa-tint', () => makeDecision('add_substrate'), 'bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300'));
    container.appendChild(createBtn('Leer Espectrofotómetro', 'fas fa-desktop', () => makeDecision('read_plate'), 'bg-green-600 hover:bg-green-500 text-white shadow-lg mt-4'));
    
    // Opciones de error (ocultas o accesibles según el contexto, pero aquí las ponemos para que el usuario pueda fallar)
    // container.appendChild(createBtn('OMITIR MUESTRA (Error)', 'fas fa-exclamation-triangle', () => makeDecision('skip_to_ab'), 'bg-red-100 hover:bg-red-200 text-red-800 border border-red-300'));
    // container.appendChild(createBtn('Añadir Ac. SIN LAVAR (Error)', 'fas fa-exclamation-triangle', () => makeDecision('bad_ab_add'), 'bg-red-100 hover:bg-red-200 text-red-800 border border-red-300'));
    // container.appendChild(createBtn('Lavar ANTES de Incubar (Error)', 'fas fa-exclamation-triangle', () => makeDecision('wash_early'), 'bg-red-100 hover:bg-red-200 text-red-800 border border-red-300'));
    // container.appendChild(createBtn('Añadir Sustrato SIN LAVAR (Error)', 'fas fa-exclamation-triangle', () => makeDecision('bad_substrate'), 'bg-red-100 hover:bg-red-200 text-red-800 border border-red-300'));
}

function makeDecision(action) {
    const macroLiquid = document.getElementById('macro-liquid');
    const macroAg = document.getElementById('macro-ag');
    const macroAbDet = document.getElementById('macro-ab-det');
    const macroStatus = document.getElementById('macro-status');
    const p1Well = wells[3]; // Focalizamos la Muestra 1 en el visor gigante

    if (action === 'skip_to_ab') {
        gameState.fatalError = "Omitió añadir la muestra. El sándwich no tiene antígeno.";
        gameState.stage = 'ab_added';
        macroStatus.innerText = "Error: Sin Antígeno";
        logAction(`<span class="text-red-600 font-bold">DECISIÓN FATAL: Añadió anticuerpo sin muestra clínica.</span>`);
    } 
    else if (action === 'add_sample') {
        gameState.stage = 'sample_added';
        
        // Actualización Macro
        macroStatus.innerText = "Antígenos flotando en el medio...";
        macroLiquid.style.height = '40%';
        macroLiquid.className = 'absolute bottom-0 w-full bg-yellow-100 opacity-50 z-10 transition-all duration-700';
        macroAg.style.opacity = '1';
        macroAg.classList.add('macro-floating');

        if (p1Well.colorFinal.includes('blue')) {
            setTimeout(() => {
                macroAg.classList.remove('macro-floating');
                macroAg.classList.add('macro-bound-ag');
                macroStatus.innerText = "Antígeno detectado y fijado";
            }, 800);
        }

        logAction(`<strong>Decisión:</strong> Muestras añadidas. Antígenos ingresan en suspensión.`);
        wells.forEach((w, i) => {
            document.getElementById(`liquid-${i}`).style.height = '40%';
            document.getElementById(`liquid-${i}`).className = 'absolute bottom-0 w-full bg-yellow-100 opacity-50 z-10 transition-all duration-700';
            
            if (w.type === 'patient') {
                const sel = document.getElementById(`dil-${i}`);
                w.val = w.val * parseFloat(sel.value); 
                sel.disabled = true; 
                sel.classList.replace('border-yellow-400', 'border-gray-300');
                sel.classList.remove('animate-pulse');
            }
            
            const ag = document.getElementById(`ag-${i}`);
            ag.style.opacity = '1';
            ag.classList.add('floating');

            if (w.colorFinal.includes('blue')) {
                setTimeout(() => {
                    ag.classList.remove('floating');
                    ag.classList.add('bound-ag'); 
                }, 800);
            }
        });
    }
    else if (action === 'wash_1') {
        gameState.stage = 'washed_1';
        
        // Actualización Macro
        macroLiquid.style.height = '0%';
        macroStatus.innerText = "Lavando sobrantes...";
        if (macroAg.classList.contains('macro-floating')) {
            macroAg.classList.add('macro-wash-away');
            macroStatus.innerText = "Antígeno lavado (No compatible)";
        }

        logAction(`<strong>Decisión:</strong> Lavado 1. Barriendo material no unido.`);
        wells.forEach((w, i) => {
            document.getElementById(`liquid-${i}`).style.height = '0%';
            const ag = document.getElementById(`ag-${i}`);
            if (ag.classList.contains('floating')) {
                ag.classList.add('wash-away');
            }
        });
    }
    else if (action === 'bad_ab_add') {
        gameState.stage = 'ab_added';
        gameState.noiseMultiplier += 0.6; 
        
        macroLiquid.style.height = '60%';
        macroAbDet.style.opacity = '1';
        macroAbDet.classList.add('macro-floating');
        macroStatus.innerText = "Alta interferencia (Sin lavar)";

        logAction(`<span class="text-orange-600 font-bold">MALA DECISIÓN: Añadió anticuerpo sin lavar. Alta interferencia cruzada.</span>`);
        wells.forEach((w, i) => {
            document.getElementById(`liquid-${i}`).style.height = '60%';
            const abDet = document.getElementById(`ab-det-${i}`);
            abDet.style.opacity = '1';
            abDet.classList.add('floating');
        });
    }
    else if (action === 'add_ab') {
        gameState.stage = 'ab_added';
        
        macroLiquid.style.height = '60%';
        macroLiquid.className = 'absolute bottom-0 w-full bg-blue-100 opacity-50 z-10 transition-all duration-700';
        macroAbDet.style.opacity = '1';
        macroAbDet.classList.add('macro-floating');
        macroStatus.innerText = "Ac de Detección añadido...";

        logAction(`<strong>Decisión:</strong> Anticuerpo de detección añadido en suspensión.`);
        wells.forEach((w, i) => {
            document.getElementById(`liquid-${i}`).style.height = '60%';
            document.getElementById(`liquid-${i}`).className = 'absolute bottom-0 w-full bg-blue-100 opacity-50 z-10 transition-all duration-700';
            
            const abDet = document.getElementById(`ab-det-${i}`);
            abDet.style.opacity = '1';
            abDet.classList.add('floating'); 
        });
    }
    else if (action === 'bad_incubate' || action === 'wash_early') {
        gameState.fatalError = "Protocolo interrumpido o lavado prematuro.";
        gameState.stage = action === 'bad_incubate' ? 'incubated' : 'washed_2';
        
        macroLiquid.style.height = '0%';
        macroStatus.innerText = "Complejo molecular arruinado";

        logAction(`<span class="text-red-600 font-bold">DECISIÓN FATAL: Arruinó la formación del complejo.</span>`);
        wells.forEach((w, i) => document.getElementById(`liquid-${i}`).style.height = '0%');
    }
    else if (action === 'incubate') {
        gameState.stage = 'incubated';
        macroStatus.innerText = "Incubando epítopos...";

        if (p1Well.colorFinal.includes('blue') && !gameState.fatalError) {
            setTimeout(() => {
                macroAbDet.classList.remove('macro-floating');
                macroAbDet.classList.add('macro-bound-ab');
                macroStatus.innerText = "¡Sándwich formado con éxito!";
            }, 1200);
        }

        logAction(`<strong>Decisión:</strong> Incubando (Epítopos acoplándose al anticuerpo)...`);
        wells.forEach((w, i) => {
            const abDet = document.getElementById(`ab-det-${i}`);
            if (w.colorFinal.includes('blue') && !gameState.fatalError) {
                setTimeout(() => {
                    abDet.classList.remove('floating');
                    abDet.classList.add('bound-ab');
                }, 1200);
            }
        });
    }
    else if (action === 'wash_2') {
        gameState.stage = 'washed_2';
        
        macroLiquid.style.height = '0%';
        if (macroAbDet.classList.contains('macro-floating')) {
            macroAbDet.classList.add('macro-wash-away');
            macroStatus.innerText = "Limpiando Ac libres...";
        }

        logAction(`<strong>Decisión:</strong> Lavado 2. Anticuerpos libres eliminados físicamente.`);
        wells.forEach((w, i) => {
            document.getElementById(`liquid-${i}`).style.height = '0%';
            const abDet = document.getElementById(`ab-det-${i}`);
            if (abDet.classList.contains('floating')) {
                abDet.classList.add('wash-away');
            }
        });
    }
    else if (action === 'bad_substrate') {
        gameState.stage = 'substrate_added';
        gameState.noiseMultiplier += 1.2; 
        macroStatus.innerText = "Error: Sustrato en Ac Libres";
        logAction(`<span class="text-red-600 font-bold">MALA DECISIÓN: Omitió lavado final. Las enzimas libres reaccionarán masivamente.</span>`);
        applySubstrateColors();
    }
    else if (action === 'add_substrate') {
        gameState.stage = 'substrate_added';
        macroStatus.innerText = "Reacción Enzimática en proceso...";
        logAction(`<strong>Decisión:</strong> Sustrato enzimático añadido (Reacción de color).`);
        applySubstrateColors();
    }
    else if (action === 'read_plate') {
        readPlateResults();
    }
    
    updateChoices();
}

function applySubstrateColors() {
    const macroLiquid = document.getElementById('macro-liquid');
    macroLiquid.style.height = '80%';
    const p1Well = wells[3];

    if (gameState.fatalError) {
        macroLiquid.className = 'absolute bottom-0 w-full z-10 transition-all duration-[2000ms] color-fondo-error';
    } else if (p1Well.colorFinal.includes('blue')) {
        macroLiquid.className = 'absolute bottom-0 w-full z-10 transition-all duration-[2000ms] color-reactivo';
        document.getElementById('macro-status').innerText = "Reacción Positiva Visualizada";
    } else {
        macroLiquid.className = 'absolute bottom-0 w-full z-10 transition-all duration-[2000ms] color-sustrato';
        document.getElementById('macro-status').innerText = "Reacción Negativa (Sin color)";
    }

    wells.forEach((w, i) => {
        const liquid = document.getElementById(`liquid-${i}`);
        liquid.style.height = '80%';
        
        if (gameState.fatalError) {
            liquid.className = 'absolute bottom-0 w-full z-10 transition-all duration-[2000ms] color-fondo-error';
        } else if (w.colorFinal.includes('blue')) {
            liquid.className = 'absolute bottom-0 w-full z-10 transition-all duration-[2000ms] color-reactivo';
        } else {
            liquid.className = 'absolute bottom-0 w-full z-10 transition-all duration-[2000ms] color-sustrato';
        }
    });
}

function readPlateResults() {
    const spectro = document.getElementById('spectro-results');
    const list = document.getElementById('results-list');
    spectro.classList.remove('hidden');
    
    document.getElementById('cutoff-display').innerText = `PUNTO DE CORTE: >= ${config.cutoff}`;
    list.innerHTML = '';
    
    wells.forEach(w => {
        let finalAbs = w.val;
        // Aplicar multiplicador de ruido por malas decisiones
        if (gameState.noiseMultiplier > 0) {
            finalAbs += gameState.noiseMultiplier * (Math.random() * 0.5 + 0.5);
        }
        if (gameState.fatalError) {
            finalAbs += (Math.random() * 0.8 + 0.5); // Inflar DO por mal protocolo del usuario
        }
        if (config.errorScenario === 'wash_fail') {
            finalAbs += 0.3; // Error aleatorio del sistema
        }
        
        const absStr = finalAbs.toFixed(2);
        let status = '';
        if(w.type === 'patient') {
            status = parseFloat(absStr) >= parseFloat(config.cutoff) ? '<span class="text-red-400 border border-red-400 px-1 font-bold">REACTIVO</span>' : '<span class="text-gray-400">NO REACTIVO</span>';
        }
        list.innerHTML += `<div class="flex justify-between border-b border-gray-800 py-1"><span>[${w.id}]</span> <span>DO: ${absStr} ${status}</span></div>`;
    });

    let verdict = "✅ Controles válidos. Corrida aceptada.";
    if (gameState.fatalError) verdict = `❌ ERROR HUMANO: ${gameState.fatalError}`;
    else if (config.errorScenario === 'pos_fail') verdict = "⚠️ ALERTA SISTEMA: Control Positivo fallido. Corrida INVÁLIDA.";
    else if (config.errorScenario === 'neg_fail') verdict = "⚠️ ALERTA SISTEMA: Señal intensa en Control Negativo. Corrida INVÁLIDA.";
    else if (gameState.noiseMultiplier > 0.5) verdict = "⚠️ ADVERTENCIA: Alto ruido de fondo por malas prácticas. Resultados dudosos.";
    
    document.getElementById('clinical-verdict').innerHTML = verdict;
    logAction(`Lectura de Espectrofotómetro finalizada. Genere su PDF.`);
    document.getElementById('controls-container').innerHTML = `<p class="text-green-600 font-bold text-center">Protocolo Finalizado</p>`;
}

// --- UTILIDADES ---
function logAction(htmlText) {
    const log = document.getElementById('action-log');
    const time = new Date().toLocaleTimeString('es-PE', { hour12: false });
    log.innerHTML += `<div class="border-b border-slate-200 pb-1"><span class="text-gray-400">[${time}]</span> <br>${htmlText}</div>`;
    log.scrollTop = log.scrollHeight;
}

function generatePDF() {
    const element = document.getElementById('report-content');
    const opt = {
        margin:       0.5,
        filename:     `Reporte_ELISA_${new Date().getTime()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
}

// Arrancar
window.onload = initLab;