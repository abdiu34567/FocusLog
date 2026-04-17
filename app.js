const tg = window.Telegram.WebApp;
const API_URL = "https://script.google.com/macros/s/AKfycbzIRxeVVTOPg0agvyMfPWOZUrUqWL81j7I0KzCFpYB5AZcktbseCWeA8zFCw8lZg49U/exec";

tg.expand();
tg.ready();

// Get User ID from Telegram
const userId = tg.initDataUnsafe?.user?.id || "local_test_user";

async function submitData() {
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const payload = {
        userId: userId,
        sleep_time: document.getElementById('sleep_time').value,
        wake_time: document.getElementById('wake_time').value,
        deep_work_hours: document.getElementById('deep_work').value,
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

        tg.HapticFeedback.notificationOccurred('success');
        alert(`Score: ${result.score}/5 - ${result.label}`);
        showStats();
    } catch (e) {
        alert("Error saving data. Check your API URL.");
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Log";
    }
}

async function showStats() {
    document.getElementById('form-screen').classList.add('hidden');
    document.getElementById('stats-screen').classList.remove('hidden');

    // Fetch History
    const hRes = await fetch(`${API_URL}?action=history&userId=${userId}`);
    const history = await hRes.json();

    const list = document.getElementById('history-list');
    list.innerHTML = history.reverse().map(item => `
        <div class="flex justify-between items-center p-4 secondary-bg rounded-xl">
            <span class="font-medium">${item.date}</span>
            <span class="font-bold text-blue-500">${item.score}/5</span>
        </div>
    `).join('');

    // Fetch Summary
    const sRes = await fetch(`${API_URL}?action=summary&userId=${userId}`);
    const summary = await sRes.json();
    document.getElementById('total-pts').innerText = summary.totalScore;
    document.getElementById('biggest-issue').innerText = `Focus on: ${summary.biggestIssue}`;
}

function showForm() {
    document.getElementById('stats-screen').classList.add('hidden');
    document.getElementById('form-screen').classList.remove('hidden');
}