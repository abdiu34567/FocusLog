const tg = window.Telegram.WebApp;
const API_URL = "https://script.google.com/macros/s/AKfycbzIRxeVVTOPg0agvyMfPWOZUrUqWL81j7I0KzCFpYB5AZcktbseCWeA8zFCw8lZg49U/exec";

tg.expand();
tg.ready();

// Get User ID from Telegram
const userId = tg.initDataUnsafe?.user?.id || "local_test_user";

// Global variable to hold data in memory (Pre-loading)
let preloadedData = { history: null, summary: null };
let isFetching = false;

// 1. START PRE-LOADING IMMEDIATELY
fetchDataInBackground();

async function fetchDataInBackground(force = false) {
    // If we already have data and aren't forcing, or if a fetch is already running, STOP.
    if ((preloadedData.history && !force) || isFetching) return;

    isFetching = true;
    try {
        const [hRes, sRes] = await Promise.all([
            fetch(`${API_URL}?action=history&userId=${userId}`),
            fetch(`${API_URL}?action=summary&userId=${userId}`)
        ]);
        preloadedData.history = await hRes.json();
        preloadedData.summary = await sRes.json();
        console.log("Background data sync complete");
    } catch (e) {
        console.error("Fetch failed", e);
    } finally {
        isFetching = false;
    }
}

async function submitData() {
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const payload = {
        userId: userId,
        sleep_time: document.getElementById('sleep_time').value,
        wake_time: document.getElementById('wake_time').value,
        goal_met: document.getElementById('goal_met').checked,
        goal_description: document.getElementById('goal_description').value,
        total_work_hours: document.getElementById('total_work').value,
        night_discipline: document.getElementById('discipline').checked,
        distraction_note: document.getElementById('note').value
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        // --- NEW: OPTIMISTIC UPDATE ---
        // 1. Construct a history item from the data we just sent
        const newEntry = {
            date: new Date().toISOString().split('T')[0], // yyyy-mm-dd
            sleep: payload.sleep_time,
            wake: payload.wake_time,
            work: payload.total_work_hours,
            goal: payload.goal_met,
            goal_text: payload.goal_description,
            disc: payload.night_discipline,
            note: payload.distraction_note,
            score: result.score
        };

        // 2. Add it to our local memory immediately
        if (!preloadedData.history) preloadedData.history = [];
        preloadedData.history.push(newEntry);

        // 3. Update the summary score in memory too
        if (preloadedData.summary) {
            preloadedData.summary.totalScore += result.score;
        }

        setTimeout(() => fetchDataInBackground(true), 2000);
        // ------------------------------

        if (tg.isVersionAtLeast('6.1')) {
            tg.HapticFeedback.notificationOccurred('success');
        }

        // Update and Show Success Overlay
        document.getElementById('big-score').innerText = result.score + "/5";
        document.getElementById('big-label').innerText = result.label;
        document.getElementById('success-overlay').classList.remove('hidden');

    } catch (e) {
        alert("Error saving data. Check your API URL.");
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Log";
    }
}

function showStats(forceRefresh = false) {
    document.getElementById('form-screen').classList.add('hidden');
    document.getElementById('stats-screen').classList.remove('hidden');

    // If data is already pre-loaded and we aren't forcing a refresh, show it instantly
    if (!forceRefresh && preloadedData.history && preloadedData.summary) {
        renderHistory(preloadedData.history);
        renderSummary(preloadedData.summary);
    } else {
        // If data isn't ready yet, show loading and fetch
        document.getElementById('history-list').innerHTML = '<p class="text-center hint py-10">Fetching fresh data...</p>';
        fetchDataInBackground().then(() => {
            renderHistory(preloadedData.history);
            renderSummary(preloadedData.summary);
        });
    }
}

function formatTime(timeVal) {
    if (!timeVal) return "--:--";

    let hours, minutes;

    if (timeVal.toString().includes('T')) {
        // Handle ISO Date String from Google
        const date = new Date(timeVal);
        hours = date.getHours();
        minutes = date.getMinutes();
    } else if (typeof timeVal === 'number') {
        // Handle raw numbers (e.g., 22 for 10 PM)
        hours = Math.floor(timeVal);
        minutes = Math.round((timeVal - hours) * 60);
    } else if (typeof timeVal === 'string' && timeVal.includes(':')) {
        // Handle "22:00" string
        const parts = timeVal.split(':');
        hours = parseInt(parts[0]);
        minutes = parseInt(parts[1]);
    } else {
        return timeVal;
    }

    // Convert to 12-hour format with AM/PM
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');

    return `${displayHours}:${displayMinutes} ${ampm}`;
}

// Helper to turn "17/4/2026" into "Fri, Apr 17"
function formatNiceDate(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderHistory(history) {
    const list = document.getElementById('history-list');

    list.innerHTML = history.slice().reverse().map(item => {
        const isTrue = (val) => val === true || val === "true";

        // Define targets for visual display
        const targetSleep = "9:00 PM";
        const targetWake = "5:00 AM";
        const targetWork = 7;

        // Logic for the checks
        const rawSleep = item.sleep.toString();
        const sleepPassed = rawSleep <= "21:00" && rawSleep.includes(':');
        const wakePassed = item.wake <= "05:00";

        return `
        <div class="secondary-bg p-5 rounded-3xl space-y-4 border border-black/5 shadow-sm">
            <div class="flex justify-between items-center border-b border-black/5 pb-3">
                <span class="text-xs font-black text-slate-400 uppercase tracking-widest">
                    ${formatNiceDate(item.date)}
                </span>
                <span class="text-2xl font-black text-blue-600">${item.score}/5</span>
            </div>
            
            <div class="space-y-4">
                <!-- Sleep Row -->
                <div class="flex justify-between items-start text-sm">
                    <div>
                        <div class="font-bold text-slate-700">🌙 Sleep</div>
                        <div class="text-[10px] text-slate-400 uppercase font-bold">Goal: before ${targetSleep}</div>
                    </div>
                    <span class="font-bold pt-1 ${sleepPassed ? 'text-green-600' : 'text-rose-500'}">
                        ${formatTime(item.sleep)} ${sleepPassed ? '✅' : '❌'}
                    </span>
                </div>

                <!-- Wake Row -->
                <div class="flex justify-between items-start text-sm">
                    <div>
                        <div class="font-bold text-slate-700">🌅 Wake</div>
                        <div class="text-[10px] text-slate-400 uppercase font-bold">Goal: before ${targetWake}</div>
                    </div>
                    <span class="font-bold pt-1 ${wakePassed ? 'text-green-600' : 'text-rose-500'}">
                        ${formatTime(item.wake)} ${wakePassed ? '✅' : '❌'}
                    </span>
                </div>

                <!-- Work Row -->
                <div class="flex justify-between items-start text-sm">
                    <div>
                        <div class="font-bold text-slate-700">⚡ Work</div>
                        <div class="text-[10px] text-slate-400 uppercase font-bold">Goal: ${targetWork}+ hours</div>
                    </div>
                    <span class="font-bold pt-1 ${item.work >= targetWork ? 'text-green-600' : 'text-rose-500'}">
                        ${item.work}h ${item.work >= targetWork ? '✅' : '❌'}
                    </span>
                </div>

                <!-- Goal Description Block (New Section) -->
                ${item.goal_text ? `
                <div class="px-1">
                    <div class="text-[10px] text-slate-400 uppercase font-bold mb-1">Target Focus</div>
                    <div class="text-xs text-slate-600 font-medium leading-tight">${item.goal_text}</div>
                </div>` : ''}

                <!-- Goal & Discipline (Simplified) -->
                <div class="grid grid-cols-2 gap-2 pt-2">
                    <div class="p-2 rounded-xl border ${isTrue(item.goal) ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-400'} text-center">
                        <div class="text-[10px] uppercase font-bold">Primary Goal</div>
                        <div class="text-xs font-bold">${isTrue(item.goal) ? 'MET ✅' : 'MISSED'}</div>
                    </div>
                    <div class="p-2 rounded-xl border ${isTrue(item.disc) ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-400'} text-center">
                        <div class="text-[10px] uppercase font-bold">Discipline</div>
                        <div class="text-xs font-bold">${isTrue(item.disc) ? 'KEPT ✅' : 'BROKEN'}</div>
                    </div>
                </div>
            </div>
            
            ${item.note ? `
            <div class="bg-white/60 p-3 rounded-2xl border border-black/5">
                <p class="text-[11px] italic text-slate-500 leading-relaxed">"${item.note}"</p>
            </div>` : ''}
        </div>
    `}).join('');
}

function showForm() {
    document.getElementById('stats-screen').classList.add('hidden');
    document.getElementById('form-screen').classList.remove('hidden');
}

function renderSummary(summary) {
    document.getElementById('total-pts').innerText = summary.totalScore;
    document.getElementById('biggest-issue').innerText = `Focus on: ${summary.biggestIssue}`;
}

function closeSuccess() {
    document.getElementById('success-overlay').classList.add('hidden');
    showStats();
}