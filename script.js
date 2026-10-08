// Startet den Offline-Modus (Service Worker) für die PWA
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').catch(err => console.log('PWA Fehler:', err)); }

let medications = [], myChart, currentMarker = 'CRP', savedNotes = [], doctors = [], folders = [], appointments = [];
const labCategories = {
    "Hämatologie (Blutbild)": ["Leukozyten", "Erythrozyten", "Hämoglobin (Hb)", "Hämatokrit (Hkt)", "MCV", "MCH", "MCHC", "Thrombozyten", "Neutrophile", "Lymphozyten"],
    "Entzündung & Infektion": ["CRP", "BSG", "Prokalzitonin"],
    "Elektrolyte & Mineralien": ["Natrium (Na)", "Kalium (K)", "Calcium (Ca)", "Magnesium (Mg)", "Chlorid (Cl)", "Phosphat"],
    "Niere & Urin": ["Kreatinin", "eGFR", "Harnstoff", "Harnsäure", "Urin-pH", "Urin-Protein", "Urin-Leukozyten"],
    "Leber & Galle": ["GOT / AST", "GPT / ALT", "GGT", "AP", "Bilirubin gesamt", "Albumin"],
    "Schilddrüse": ["TSH", "fT3", "fT4", "TPO-AK", "TRAK"],
    "Eisen & Anämie": ["Ferritin", "Eisen", "Transferrin", "Vitamin B12", "Folsäure"],
    "Stoffwechsel & Lipide": ["Nüchternglukose", "HbA1c", "Gesamtcholesterin", "HDL", "LDL", "Triglyceride"],
    "Vitamine & Spurenelemente": ["Vitamin D", "Vitamin B1", "Vitamin B6", "Zink", "Kupfer", "Selen", "Jod"],
    "Gerinnung": ["INR", "Quick", "aPTT", "Fibrinogen", "D-Dimer"]
};
let labData = {}, darkMode = false;

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => { const s = document.getElementById('splash-screen'); if(s){ s.style.opacity = '0'; setTimeout(()=>s.style.display='none', 800); } }, 2600);
    window.quill = new Quill('#quill-editor', { theme: 'snow', placeholder: 'Schreibe hier...', modules: { toolbar: [[{'header':[1,2,3,false]}],['bold','italic','underline','strike'],[{'color':[]},{'background':[]}],[{'list':'ordered'},{'list':'bullet'}],[{'align':[]}],['clean']] }});
    checkDarkMode(); initLabData(); loadProfile(); loadFolders(); loadDoctors(); loadMedications(); loadLabData(); loadNotes(); loadAppointments();
    const ctx = document.getElementById('labChart').getContext('2d');
    myChart = new Chart(ctx, { type: 'line', data: { labels: labData[currentMarker].labels, datasets: [{ label: currentMarker, data: labData[currentMarker].values, borderColor: '#00796b', backgroundColor: 'rgba(0,121,107,0.2)', borderWidth: 2, fill: true, tension: 0.4 }]}});
    renderLabTable(); feather.replace();
});

function showPage(id, btn) {
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(btn){ document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
}

function checkDarkMode() { const s = localStorage.getItem('medspaceDarkMode'); if(s === 'true') { document.body.classList.add('dark-mode'); document.getElementById('dark-mode-toggle').checked = true; darkMode = true; } }
function toggleDarkMode() { darkMode = !darkMode; if(darkMode) { document.body.classList.add('dark-mode'); localStorage.setItem('medspaceDarkMode', 'true'); } else { document.body.classList.remove('dark-mode'); localStorage.setItem('medspaceDarkMode', 'false'); } }
function saveProfile() { const d = { name: document.getElementById('profil-name').value, geburt: document.getElementById('profil-geburt').value, diagnosen: document.getElementById('profil-diagnosen').value, notfall: document.getElementById('profil-notfall').value }; localStorage.setItem('healthAppProfile', JSON.stringify(d)); loadProfile(); showToast("Profil erfolgreich gespeichert! ✅"); }
function loadProfile() { const s = localStorage.getItem('healthAppProfile'); if (s) { const d = JSON.parse(s); document.getElementById('profil-name').value = d.name||""; document.getElementById('profil-geburt').value = d.geburt||""; document.getElementById('profil-diagnosen').value = d.diagnosen||""; document.getElementById('profil-notfall').value = d.notfall||""; if (d.name && d.name.trim()!=="") { document.getElementById('dashboard-welcome').innerText = "Hallo "+d.name.split(" ")[0]+"!"; document.getElementById('dashboard-profile-hint').style.display='none'; } } }

// --- TERMINE (NEU) ---
function loadAppointments() { const s = localStorage.getItem('healthAppAppts'); if(s) appointments = JSON.parse(s); renderAppointments(); }
function renderAppointments() {
    const list = document.getElementById('appointments-list'), dashList = document.getElementById('dash-appointments-list');
    list.innerHTML = ""; dashList.innerHTML = "";
    if(appointments.length === 0) { list.innerHTML = "<p style='color:gray; font-size:0.9rem;'>Keine Termine gespeichert.</p>"; dashList.innerHTML = "<p style='color:gray; font-size:0.9rem;'>Keine anstehenden Termine.</p>"; return; }
    
    appointments.sort((a, b) => new Date(a.date) - new Date(b.date)); // Nach Datum sortieren
    let upcomingCount = 0; const now = new Date();
    
    appointments.forEach(app => {
        const appDate = new Date(app.date);
        const isPast = appDate < now && appDate.toDateString() !== now.toDateString(); // Ist der Termin vorbei?
        
        const dateStr = appDate.toLocaleDateString('de-DE', {weekday:'short', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
        const docName = app.doctorId && app.doctorId !== "0" ? doctors.find(d => d.id == app.doctorId)?.name || "Unbekannter Arzt" : "Kein Arzt verknüpft";
        
        // Wenn vergangen: Ausgrauen!
        const opacity = isPast ? "0.5" : "1";
        const filter = isPast ? "grayscale(100%)" : "none";
        const pastBadge = isPast ? "<span style='color:#e74c3c; font-size:0.8rem; margin-left:10px;'>(Abgelaufen)</span>" : "";

        const html = `<div style="padding:15px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:flex-start; opacity: ${opacity}; filter: ${filter};">
            <div style="flex:1;">
                <div style="color:var(--primary-color); font-weight:bold; font-size:1.05rem;">${dateStr} Uhr ${pastBadge}</div>
                <div style="font-weight:500; margin-top:3px;"><i data-feather="user" style="width:14px; margin-right:5px;"></i>${docName}</div>
                ${app.notes ? `<div style="font-size:0.85rem; color:var(--text-color); margin-top:8px; background:rgba(0,121,107,0.05); padding:8px; border-radius:6px; border-left:3px solid var(--primary-color);">${app.notes}</div>` : ''}
            </div>
            <button onclick="deleteAppointment(${app.id})" style="background:none; border:none; color:#e74c3c; cursor:pointer; padding:5px; margin-left:10px;"><i data-feather="trash-2" style="width:20px;"></i></button>
        </div>`;
        
        list.innerHTML += html;
        
        // Nur ZUKÜNFTIGE Termine aufs Dashboard packen
        if(!isPast) { dashList.innerHTML += html; upcomingCount++; }
    });
    if(upcomingCount === 0) dashList.innerHTML = "<p style='color:gray; font-size:0.9rem;'>Keine zukünftigen Termine.</p>";
    feather.replace();
}

function addAppointment() {
    const d = document.getElementById('appt-date').value, docId = document.getElementById('appt-doctor-select').value, n = document.getElementById('appt-notes').value;
    if(!d) { alert("Bitte Datum auswählen!"); return; }
    appointments.push({ id: Date.now(), date: d, doctorId: docId, notes: n }); localStorage.setItem('healthAppAppts', JSON.stringify(appointments));
    document.getElementById('appt-date').value = ""; document.getElementById('appt-doctor-select').value = "0"; document.getElementById('appt-notes').value = ""; renderAppointments();
}
function deleteAppointment(id) { if(confirm("Termin wirklich löschen?")) { appointments = appointments.filter(a => a.id !== id); localStorage.setItem('healthAppAppts', JSON.stringify(appointments)); renderAppointments(); } }
function updateApptDoctorSelect() {
    const sel = document.getElementById('appt-doctor-select'); if(!sel) return; sel.innerHTML = "<option value='0'>Ohne Arzt-Verknüpfung</option>";
    doctors.forEach(d => { sel.innerHTML += `<option value='${d.id}'>${d.name} (${d.fach})</option>`; });
}

// --- ORDNER ---
function selectColor(el, hex) { document.querySelectorAll('.color-circle').forEach(e => e.classList.remove('selected')); el.classList.add('selected'); document.getElementById('new-folder-color').value = hex; document.getElementById('hex-color-input').value = hex.substring(1); }
function updateHexColor(v) { let clean = v.replace('#', ''); document.getElementById('hex-color-input').value = clean; document.querySelectorAll('.color-circle').forEach(e => e.classList.remove('selected')); if(clean.length === 6) document.getElementById('new-folder-color').value = '#' + clean; }
function loadFolders() { const s = localStorage.getItem('healthAppFolders'); folders = s ? JSON.parse(s) : [{id:1,name:"Arztbriefe",color:"#e74c3c"}, {id:2,name:"Befunde",color:"#3498db"}]; renderFoldersList(); }
function renderFoldersList() {
    const cont = document.getElementById('folder-container'); cont.innerHTML = "";
    const selEd = document.getElementById('note-folder-select'), selDoc = document.getElementById('doc-folder-link');
    selEd.innerHTML = "<option value='0'>Kein Ordner</option>"; selDoc.innerHTML = "<option value='0'>Ohne Verknüpfung</option>";
    folders.forEach(f => {
        const div = document.createElement('div'); div.className = 'folder-item'; div.onclick = () => openFolder(f.id, f.name);
        div.innerHTML = `<i data-feather='folder' style='color:${f.color}; width:35px; height:35px;'></i><span style='font-weight:500;'>${f.name}</span>`; cont.appendChild(div);
        selEd.innerHTML += `<option value='${f.id}'>${f.name}</option>`; selDoc.innerHTML += `<option value='${f.id}'>${f.name}</option>`;
    }); feather.replace();
}
function createNewFolder() { const name = document.getElementById('new-folder-name').value, color = document.getElementById('new-folder-color').value; if(name.trim()==="") return; folders.push({id:Date.now(), name, color}); localStorage.setItem('healthAppFolders', JSON.stringify(folders)); document.getElementById('new-folder-name').value = ""; renderFoldersList(); }

// --- ORDNER & FOTO LOGIK ---
let currentOpenFolderId = null;

function openFolder(id, name) { 
    currentOpenFolderId = id; // Merkt sich den offenen Ordner
    document.getElementById('folder-list-view').style.display='none'; 
    document.getElementById('folder-content-view').style.display='block'; 
    document.getElementById('current-folder-name').innerHTML = `<i data-feather='folder' style='width:20px;'></i> ${name}`; 
    renderFolderItems(id); 
    feather.replace(); 
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showToast("Bild wird komprimiert und gespeichert... ⏳");
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Intelligente Komprimierung (Max 800px Breite)
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // In stark komprimiertes JPEG umwandeln (Qualität 0.7)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // Als neues Dokument speichern
            const dStr = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
            const title = prompt("Wie soll das Foto heißen?", "Befund vom " + dStr.split(',')[0]);
            if(title === null) return; // Abbruch
            
            const content = `<img src="${compressedDataUrl}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">`;
            
            savedNotes.push({id: Date.now(), title: title || "Neues Foto", content: content, folderId: currentOpenFolderId, date: dStr});
            localStorage.setItem('healthAppNotes', JSON.stringify(savedNotes));
            
            document.getElementById('dash-doc-count').innerText = savedNotes.length;
            renderFolderItems(currentOpenFolderId);
            renderNotesList();
            showToast("Befund erfolgreich gespeichert! 📸");
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function closeFolder() { document.getElementById('folder-content-view').style.display='none'; document.getElementById('folder-list-view').style.display='block'; }
function renderFolderItems(fId) {
    const cont = document.getElementById('folder-items-list'); cont.innerHTML = ""; const items = savedNotes.filter(n => n.folderId == fId);
    if(items.length===0){ cont.innerHTML = "<p style='color:gray; font-size:0.9rem;'>Dieser Ordner ist noch leer.</p>"; return; }
    items.forEach(n => {
        const d = document.createElement('div'); d.style.padding = "10px 0"; d.style.borderBottom = "1px solid var(--border-color)";
        d.innerHTML = `<div style='cursor:pointer;' onclick='openNoteFromFolder(${n.id})'><i data-feather='file-text' style='color:#00796b; width:16px; margin-right:8px;'></i><strong>${n.title}</strong><div style='font-size:0.75rem; color:gray; margin-top:4px;'>${n.date}</div></div>`; cont.appendChild(d);
    });
}
function openNoteFromFolder(id) { showPage('editor', null); openExistingNote(id); }

// --- ÄRZTE ---
function loadDoctors() { 
    const s = localStorage.getItem('healthAppDocs'); if(s) doctors = JSON.parse(s); 
    doctors.forEach(d => { if(!d.id) d.id = Math.floor(Math.random() * 1000000); }); // Stellt sicher, dass alte Ärzte eine ID bekommen
    localStorage.setItem('healthAppDocs', JSON.stringify(doctors));
    document.getElementById('dash-doc-doc-count').innerText = doctors.length; 
    renderDoctorsList(); updateApptDoctorSelect();
}
function renderDoctorsList() {
    const cont = document.getElementById('doctors-list'); cont.innerHTML = ""; if(doctors.length===0){ cont.innerHTML = "<p style='color:gray; font-size:0.9rem;'>Noch keine Ärzte gespeichert.</p>"; return; }
    doctors.forEach((d) => {
        const div = document.createElement('div'); div.style.cssText = "padding:10px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;"; let linkBtn = "";
        if(d.folderId && d.folderId !== "0") { const f = folders.find(x => x.id == d.folderId); if(f) linkBtn = `<button onclick='jumpToFolder(${d.folderId}, "${f.name}")' style='background:transparent; border:1px solid var(--border-color); padding:4px 8px; border-radius:5px; font-size:0.75rem; cursor:pointer; color:var(--primary-color); margin-top:5px;'><i data-feather='folder' style='width:12px; height:12px;'></i> Zur Akte</button>`; }
        div.innerHTML = `<div><strong>${d.name}</strong> <span style='color:gray; font-size:0.85rem;'>(${d.fach})</span><br><a href='tel:${d.tel}' style='color:var(--primary-color); text-decoration:none; font-size:0.9rem;'>📞 ${d.tel}</a><br>${linkBtn}</div><button onclick='deleteDoctor(${d.id})' style='background:none; border:none; color:#e74c3c; cursor:pointer;'><i data-feather='trash-2' style='width:18px; height:18px;'></i></button>`; cont.appendChild(div);
    }); feather.replace();
}
function addDoctor() { const name = document.getElementById('doc-name').value, fach = document.getElementById('doc-fach').value, tel = document.getElementById('doc-tel').value, fId = document.getElementById('doc-folder-link').value; if(name==="") return; doctors.push({id: Date.now(), name, fach, tel, folderId: fId}); localStorage.setItem('healthAppDocs', JSON.stringify(doctors)); document.getElementById('dash-doc-doc-count').innerText = doctors.length; document.getElementById('doc-name').value = ""; document.getElementById('doc-fach').value = ""; document.getElementById('doc-tel').value = ""; document.getElementById('doc-folder-link').value = "0"; renderDoctorsList(); updateApptDoctorSelect(); }
function deleteDoctor(id) { if(confirm("Diesen Arzt löschen?")) { doctors = doctors.filter(d => d.id !== id); localStorage.setItem('healthAppDocs', JSON.stringify(doctors)); document.getElementById('dash-doc-doc-count').innerText = doctors.length; renderDoctorsList(); updateApptDoctorSelect(); renderAppointments(); } }
function jumpToFolder(id, name) { showPage('dokumente', document.getElementById('nav-dokumente')); openFolder(id, name); }

// --- BRIEFE ---
function loadNotes() { const s = localStorage.getItem('healthAppNotes'); if(s) savedNotes = JSON.parse(s); document.getElementById('dash-doc-count').innerText = savedNotes.length; renderNotesList(); }
function renderNotesList() {
    const cont = document.getElementById('saved-notes-container'); cont.innerHTML = ""; if(savedNotes.length===0){ cont.innerHTML = "<p style='color:gray; font-size:0.9rem;'>Noch keine Dokumente.</p>"; return; }
    savedNotes.forEach(n => {
        const d = document.createElement('div'); d.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);";
        d.innerHTML = `<div style='cursor:pointer; flex:1;' onclick='openExistingNote(${n.id})'><i data-feather='file-text' style='width:16px; color:#00796b; margin-right:8px;'></i><strong>${n.title}</strong><div style='font-size:0.75rem; color:gray; margin-top:4px;'>${n.date}</div></div><button onclick='deleteNote(${n.id})' style='background:none; border:none; color:#e74c3c; cursor:pointer; padding:5px;'><i data-feather='trash-2' style='width:18px; height:18px;'></i></button>`; cont.appendChild(d);
    }); feather.replace();
}
function createNewNote() { document.getElementById('current-note-id').value = ""; document.getElementById('note-title').value = ""; document.getElementById('note-folder-select').value = "0"; window.quill.root.innerHTML = ""; document.getElementById('notes-list-view').style.display='none'; document.getElementById('editor-view').style.display='block'; }
function closeEditor() { document.getElementById('editor-view').style.display='none'; document.getElementById('notes-list-view').style.display='block'; }
function openExistingNote(id) { const n = savedNotes.find(x => x.id === id); if(!n) return; document.getElementById('current-note-id').value = n.id; document.getElementById('note-title').value = n.title; document.getElementById('note-folder-select').value = n.folderId||"0"; window.quill.root.innerHTML = n.content; document.getElementById('notes-list-view').style.display='none'; document.getElementById('editor-view').style.display='block'; }
function saveNote() {
    const idF = document.getElementById('current-note-id').value, c = window.quill.root.innerHTML, fId = document.getElementById('note-folder-select').value; let t = document.getElementById('note-title').value; if(t.trim()==="") t = "Unbenanntes Dokument";
    const dStr = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
    if(idF==="") { savedNotes.push({id:Date.now(), title:t, content:c, folderId:fId, date:dStr}); } else { const i = savedNotes.findIndex(x => x.id === parseInt(idF)); if(i>-1){ savedNotes[i].title=t; savedNotes[i].content=c; savedNotes[i].folderId=fId; savedNotes[i].date=dStr; } }
    localStorage.setItem('healthAppNotes', JSON.stringify(savedNotes)); document.getElementById('dash-doc-count').innerText = savedNotes.length; renderNotesList(); closeEditor(); if(document.getElementById('folder-content-view').style.display==='block') renderFolderItems(fId);
}
function deleteNote(id) { if(confirm("Wirklich löschen?")) { savedNotes = savedNotes.filter(n => n.id!==id); localStorage.setItem('healthAppNotes', JSON.stringify(savedNotes)); document.getElementById('dash-doc-count').innerText = savedNotes.length; renderNotesList(); if(document.getElementById('folder-content-view').style.display==='block') closeFolder(); } }

// --- MEDIKAMENTE ---
function loadMedications() { const s = localStorage.getItem('healthAppMeds'); if(s) medications = JSON.parse(s); renderMedTable(); }
function renderMedTable() {
    const tb = document.getElementById('med-tbody'); tb.innerHTML = "";
    medications.forEach((m, i) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${m.name}</td><td>${m.schema}</td><td>${m.hinweis}</td><td class="no-print"><button onclick='deleteMedication(${i})' style='background:none; border:none; color:#e74c3c; cursor:pointer;'><i data-feather='trash-2' style='width:18px; height:18px;'></i></button></td>`; tb.appendChild(tr); }); feather.replace();
}
function addMedication() { const n = document.getElementById('med-name').value, s = document.getElementById('med-schema').value, h = document.getElementById('med-hinweis').value; if(n==="") return; medications.push({name:n, schema:s, hinweis:h}); localStorage.setItem('healthAppMeds', JSON.stringify(medications)); document.getElementById('med-name').value = ""; document.getElementById('med-schema').value = ""; document.getElementById('med-hinweis').value = ""; renderMedTable(); }
function deleteMedication(i) { medications.splice(i, 1); localStorage.setItem('healthAppMeds', JSON.stringify(medications)); renderMedTable(); }
function exportMedPlanPDF() { const element = document.getElementById('med-pdf-area'); const title = document.getElementById('pdf-title'); const trashBtns = element.querySelectorAll('.no-print'); title.style.display = 'block'; trashBtns.forEach(btn => btn.style.display = 'none'); const opt = { margin: 10, filename: 'Medikationsplan.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }; html2pdf().set(opt).from(element).save().then(() => { title.style.display = 'none'; trashBtns.forEach(btn => btn.style.display = ''); }); }

// --- LABORWERTE ---
function initLabData() { for (let category in labCategories) { labCategories[category].forEach(marker => { labData[marker] = { labels: [], values: [] }; }); } }
function loadLabData() { const s = localStorage.getItem('healthAppAllLabData'); if(s) { const parsed = JSON.parse(s); for(let k in labData) { if(parsed[k]) labData[k] = parsed[k]; } } if(labData['CRP'].labels.length === 0) { labData['CRP'] = { labels: ['Jan', 'Feb', 'Mär'], values: [15, 22, 12] }; } updateDropdown(); }
function updateDropdown() {
    const sel = document.getElementById('lab-marker-select'); sel.innerHTML = "";
    for (let category in labCategories) { const optgroup = document.createElement('optgroup'); optgroup.label = "── " + category + " ──"; labCategories[category].forEach(marker => { const opt = document.createElement('option'); opt.value = marker; opt.innerText = marker; optgroup.appendChild(opt); }); sel.appendChild(optgroup); }
    sel.innerHTML += `<option value='ADD_NEW' style='font-weight:bold; color:#00796b;'>+ Eigenen Wert hinzufügen...</option>`; sel.value = currentMarker;
}
function switchMarker() { const sel = document.getElementById('lab-marker-select').value; if(sel === "ADD_NEW") { const n = prompt("Wie heißt der neue Laborwert?"); if(n && n.trim()!=="") { if(!labData[n]) labData[n] = {labels:[], values:[]}; currentMarker = n; localStorage.setItem('healthAppAllLabData', JSON.stringify(labData)); updateDropdown(); } else { document.getElementById('lab-marker-select').value = currentMarker; return; } } else { currentMarker = sel; } document.getElementById('input-title').innerText = "Neuen Wert eintragen: " + currentMarker; updateChartAndTable(); }
function updateChartAndTable() { myChart.data.labels = labData[currentMarker].labels; myChart.data.datasets[0].data = labData[currentMarker].values; myChart.data.datasets[0].label = currentMarker; myChart.update(); renderLabTable(); }
function renderLabTable() {
    const tb = document.getElementById('lab-tbody'); tb.innerHTML = ""; const l = labData[currentMarker].labels, v = labData[currentMarker].values;
    for(let i=0; i<l.length; i++) { const tr = document.createElement('tr'); tr.innerHTML = `<td>${l[i]}</td><td>${v[i]}</td><td><button onclick='deleteLabValue(${i})' style='background:none; border:none; color:#e74c3c; cursor:pointer;'><i data-feather='trash-2' style='width:18px; height:18px;'></i></button></td>`; tb.appendChild(tr); }
    feather.replace();
}
function addLabValue() { const d = document.getElementById('lab-date').value, v = document.getElementById('lab-value').value; if(d==="" || v==="") return; labData[currentMarker].labels.push(d); labData[currentMarker].values.push(parseFloat(v)); localStorage.setItem('healthAppAllLabData', JSON.stringify(labData)); document.getElementById('lab-date').value = ""; document.getElementById('lab-value').value = ""; updateChartAndTable(); }
function deleteLabValue(i) { labData[currentMarker].labels.splice(i, 1); labData[currentMarker].values.splice(i, 1); localStorage.setItem('healthAppAllLabData', JSON.stringify(labData)); updateChartAndTable(); }


// --- ECHTER SCANNER / OCR LOGIK (Tesseract.js) ---

function openScannerModal() { 
    document.getElementById('scanner-modal').style.display = 'flex'; 
    document.getElementById('scanner-step-1').style.display = 'block'; 
    document.getElementById('scanner-step-2').style.display = 'none'; 
    document.getElementById('scanner-step-3').style.display = 'none'; 
}
function closeScannerModal() { document.getElementById('scanner-modal').style.display = 'none'; }

function startFakeScan(type) {
    const input = document.createElement('input'); 
    input.type = 'file';
    if (type === 'foto') { input.setAttribute('accept', 'image/*'); input.setAttribute('capture', 'environment'); } 
    else { input.setAttribute('accept', 'application/pdf, image/*'); }
    
    input.onchange = async (e) => {
        if(e.target.files.length > 0) {
            const file = e.target.files[0];
            document.getElementById('scanner-step-1').style.display = 'none'; 
            document.getElementById('scanner-step-2').style.display = 'block';
            document.getElementById('scan-status-text').innerText = "KI liest das Bild... (Das kann kurz dauern)";
            
            try {
                const result = await Tesseract.recognize(file, 'deu');
                const text = result.data.text;
                processOCRText(text); 
            } catch (err) {
                showToast("Fehler beim Lesen des Bildes. Bitte nochmal versuchen.");
                closeScannerModal();
            }
        }
    };
    input.click();
}

// Das Wörterbuch (Aliase)
const labDictionary = {
    "hämoglobin": { id: "Hämoglobin (Hb)", unit: "g/dl" },
    "haemoglobin": { id: "Hämoglobin (Hb)", unit: "g/dl" },
    "hb": { id: "Hämoglobin (Hb)", unit: "g/dl" },
    "leukozyten": { id: "Leukozyten", unit: "/nl" },
    "leukos": { id: "Leukozyten", unit: "/nl" },
    "crp": { id: "CRP", unit: "mg/l" },
    "kreatinin": { id: "Kreatinin", unit: "mg/dl" },
    "krea": { id: "Kreatinin", unit: "mg/dl" },
    "ferritin": { id: "Ferritin", unit: "µg/l" },
    "tsh": { id: "TSH", unit: "mIU/l" }
};

let currentScannedValues = []; 

// NEU: Die intelligente, robuste Suche!
// NEU: Die intelligente Suche MIT Diagnose-Anzeige (Was hat die KI gelesen?)
function processOCRText(text) {
    currentScannedValues = [];
    const lowerText = text.toLowerCase();
    
    for (let key in labDictionary) {
        const index = lowerText.indexOf(key);
        if (index !== -1) {
            const textAfterKeyword = lowerText.substring(index, index + 35);
            const numberMatch = textAfterKeyword.match(/\d+[\,\.]?\d*/);
            
            if (numberMatch) {
                let numberVal = numberMatch[0].replace(',', '.'); 
                
                if(!currentScannedValues.find(v => v.marker === labDictionary[key].id)) {
                    currentScannedValues.push({ 
                        marker: labDictionary[key].id, 
                        value: numberVal, 
                        unit: labDictionary[key].unit 
                    });
                }
            }
        }
    }
    
    document.getElementById('scanner-step-2').style.display = 'none';
    generateMockResults(currentScannedValues, text); // Wir übergeben den Rohtext!
    document.getElementById('scanner-step-3').style.display = 'block';
}

function generateMockResults(foundValues, rawText) {
    const tbody = document.getElementById('scanner-results-body'); 
    tbody.innerHTML = "";
    
    // Die Info oben drüber anpassen
    const infoText = document.querySelector('#scanner-step-3 p');
    if(infoText) {
        if(foundValues.length === 0) {
            infoText.innerText = "Keine bekannten Werte gefunden. Schau dir unten an, was die KI gelesen hat:";
            infoText.style.color = "#e74c3c"; // Rot bei Fehler
        } else {
            infoText.innerText = `Wir haben ${foundValues.length} Wert(e) gefunden. Bitte überprüfe die Angaben.`;
            infoText.style.color = "#00796b"; // Grün bei Erfolg
        }
    }
    
    foundValues.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="text-align:center;"><input type="checkbox" id="scan-check-${index}" checked style="width:18px; height:18px; accent-color:#00796b;"></td><td style="font-weight:bold;">${item.marker}</td><td><input type="number" id="scan-val-${index}" value="${item.value}" step="0.1" class="clean-input" style="margin:0; padding:5px 0; width:60px;"> ${item.unit}</td>`;
        tbody.appendChild(tr);
    });

    // --- NEU: KI-Rohtext anzeigen ---
    let debugBox = document.getElementById('ocr-debug-box');
    if(!debugBox) {
        debugBox = document.createElement('div');
        debugBox.id = 'ocr-debug-box';
        debugBox.style.cssText = 'margin-top:20px; font-size:0.75rem; color:gray; max-height:100px; overflow-y:auto; border:1px solid #ddd; padding:8px; border-radius:6px; background:#f9f9f9;';
        document.getElementById('scanner-step-3').appendChild(debugBox);
    }
    debugBox.innerHTML = `<strong>Rohtext der KI:</strong><br><pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace;">${rawText}</pre>`;
}


function importScannedValues() {
    const today = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'short'});
    
    currentScannedValues.forEach((item, index) => {
        const checkbox = document.getElementById(`scan-check-${index}`);
        if(checkbox && checkbox.checked) {
            const finalValue = document.getElementById(`scan-val-${index}`).value;
            if(labData[item.marker]) { 
                labData[item.marker].labels.push(today); 
                labData[item.marker].values.push(parseFloat(finalValue)); 
            }
        }
    });
    localStorage.setItem('healthAppAllLabData', JSON.stringify(labData)); 
    updateChartAndTable(); 
    closeScannerModal(); 
    showToast("Werte erfolgreich importiert! ✅");
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.cssText = "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#00796b; color:white; padding:12px 24px; border-radius:30px; box-shadow:0 4px 10px rgba(0,0,0,0.2); z-index:9999; font-size:0.9rem; font-weight:bold; opacity:0; transition:opacity 0.3s ease-in-out;";
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}



// --- BACKUP SYSTEM (EXPORT / IMPORT) ---

function exportData() {
    // Sammelt alle Daten aus dem lokalen Speicher
    const backup = {
        profile: localStorage.getItem('healthAppProfile'),
        folders: localStorage.getItem('healthAppFolders'),
        doctors: localStorage.getItem('healthAppDocs'),
        notes: localStorage.getItem('healthAppNotes'),
        meds: localStorage.getItem('healthAppMeds'),
        labs: localStorage.getItem('healthAppAllLabData'),
        appts: localStorage.getItem('healthAppAppts'),
        darkMode: localStorage.getItem('medspaceDarkMode')
    };

    // Erstellt eine JSON-Datei
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "medspace_backup_" + new Date().toLocaleDateString('de-DE').replace(/\./g, '-') + ".json");
    document.body.appendChild(downloadAnchorNode); // für Firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    showToast("Backup erfolgreich heruntergeladen! 💾");
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            
            // Alte Daten überschreiben
            if(backup.profile) localStorage.setItem('healthAppProfile', backup.profile);
            if(backup.folders) localStorage.setItem('healthAppFolders', backup.folders);
            if(backup.doctors) localStorage.setItem('healthAppDocs', backup.doctors);
            if(backup.notes) localStorage.setItem('healthAppNotes', backup.notes);
            if(backup.meds) localStorage.setItem('healthAppMeds', backup.meds);
            if(backup.labs) localStorage.setItem('healthAppAllLabData', backup.labs);
            if(backup.appts) localStorage.setItem('healthAppAppts', backup.appts);
            if(backup.darkMode) localStorage.setItem('medspaceDarkMode', backup.darkMode);
            
            alert("Daten erfolgreich wiederhergestellt! Die App wird jetzt neu geladen.");
            window.location.reload(); // App neu laden, um Daten anzuzeigen
            
        } catch (error) {
            alert("Fehler beim Lesen der Datei. Ist es die richtige Backup-Datei?");
        }
    };
    reader.readAsText(file);
}


// --- PIN SPERRE LOGIK ---
setTimeout(() => {
    const hasPin = localStorage.getItem('medspacePin');
    if(hasPin) { document.getElementById('pin-lock-screen').style.display = 'flex'; }
    updatePinUI();
}, 100);

function checkPinInput() {
    const val = document.getElementById('pin-input').value;
    const appPin = localStorage.getItem('medspacePin');
    if(val.length === 4) {
        if(val === appPin) {
            document.getElementById('pin-lock-screen').style.display = 'none';
            document.getElementById('pin-input').value = '';
            document.getElementById('pin-error').style.display = 'none';
        } else {
            document.getElementById('pin-error').style.display = 'block';
            document.getElementById('pin-input').value = '';
            setTimeout(() => document.getElementById('pin-error').style.display = 'none', 2000);
        }
    }
}

function updatePinUI() {
    const hasPin = localStorage.getItem('medspacePin');
    const setupArea = document.getElementById('pin-setup-area');
    const activeArea = document.getElementById('pin-active-area');
    if(setupArea && activeArea) {
        if(hasPin) { setupArea.style.display = 'none'; activeArea.style.display = 'block'; } 
        else { setupArea.style.display = 'block'; activeArea.style.display = 'none'; }
    }
}

function saveNewPin() {
    const val = document.getElementById('new-pin-input').value;
    if(val.length === 4 && !isNaN(val)) {
        localStorage.setItem('medspacePin', val);
        updatePinUI();
        document.getElementById('new-pin-input').value = '';
        showToast("PIN-Sperre aktiviert! 🔒");
    } else {
        showToast("Bitte genau 4 Zahlen eingeben! ❌");
    }
}

function removePin() {
    if(confirm("Möchtest du die PIN-Sperre wirklich entfernen?")) {
        localStorage.removeItem('medspacePin');
        updatePinUI();
        showToast("PIN-Sperre entfernt! 🔓");
    }
}







