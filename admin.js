/**
 * Admin Panel Script for WAVE 3.0 Live Dashboard
 * Handles writing to localStorage to sync data across browser tabs
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('adminForm');
    const notification = document.getElementById('notification');
    const resetBtn = document.getElementById('resetDefaults');

    // Default values mapping corresponds to the placeholder in the main HTML
    const defaultData = {
        eventStage: '2',
        liveTimer: '24:00:00',
        telemetryCheckedIn: '145',
        telemetryReviews: '98', // Assuming out of 155
        winnerChampion: 'Team TBA',
        winnerRunnerUp: 'Team TBA',
        winnerThird: 'Team TBA',
        leaderboardDataJSON: JSON.stringify([
            { rank: 1, avatar: 'A', name: 'Team Apex', college: 'BEC Bagalkot', tClass: 'primary', theme: 'EdTech', progress: 95, score: 92.5 },
            { rank: 2, avatar: 'N', name: 'Code Ninjas', college: 'VTU Belgaum', tClass: 'secondary', theme: 'Gen AI', progress: 88, score: 89.0 },
            { rank: 3, avatar: 'B', name: 'Byte Me', college: 'BMSCE Bangalore', tClass: 'tertiary', theme: 'Healthcare', progress: 85, score: 86.5 },
            { rank: 4, avatar: 'S', name: 'Syntax Error', college: 'RVCE', tClass: 'primary', theme: 'EdTech', progress: 75, score: 80.1 }
        ], null, 4),
        showAnnouncement: false,
        announcementMessage: ''
    };

    // Load existing values from localStorage
    function loadSavedData() {
        for (const key in defaultData) {
            const el = document.getElementById(key);
            if (el) {
                const storedVal = localStorage.getItem(`dashboard:${key}`);
                if (el.type === 'checkbox') {
                    el.checked = storedVal === 'true';
                } else {
                    el.value = storedVal !== null ? storedVal : defaultData[key];
                }
            }
        }

        const unlocked = localStorage.getItem('dashboard:resultsUnlocked');
        const cb = document.getElementById('resultsUnlocked');
        if (cb) cb.checked = unlocked === 'true';
    }

    loadSavedData();

    // Admin Auth Logic
    const authOverlay = document.getElementById('authOverlay');
    const loginBtn = document.getElementById('loginBtn');
    const pwdInput = document.getElementById('adminPassword');
    const authError = document.getElementById('authError');

    // Check if already authenticated this session
    if (sessionStorage.getItem('adminAuthenticated') === 'true') {
        authOverlay.classList.add('hidden');
    }

    function attemptLogin() {
        if (pwdInput.value === 'hWv3@bec#26') {
            sessionStorage.setItem('adminAuthenticated', 'true');
            authOverlay.classList.add('hidden');
            authError.style.display = 'none';
        } else {
            authError.style.display = 'block';
            pwdInput.value = '';
        }
    }

    if (loginBtn && pwdInput) {
        loginBtn.addEventListener('click', attemptLogin);
        pwdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
    }

    // Show Notification Helper
    function showNotification(message, iconClass, isSuccess) {
        const icon = notification.querySelector('i');
        const text = notification.querySelector('span');

        icon.className = iconClass;
        text.textContent = message;

        notification.style.background = isSuccess ? 'var(--success)' : 'var(--chart-3)';

        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Handle Form Submit (Broadcast)
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let updatedCount = 0;

        // Save all populated inputs, textareas, and selects to localStorage
        const elements = form.querySelectorAll('input, textarea, select');

        // Validate JSON first if textarea is dirty
        const jsonField = document.getElementById('leaderboardDataJSON');
        if (jsonField) {
            const val = jsonField.value.trim();
            if (val !== '') {
                try {
                    JSON.parse(val);
                } catch (err) {
                    showNotification('Invalid JSON in Leaderboard Data', 'fa-solid fa-triangle-exclamation', false);
                    return; // Stop submission
                }
            }
        }

        elements.forEach(el => {
            if (el.type === 'checkbox') {
                localStorage.setItem(`dashboard:${el.id}`, el.checked);
                updatedCount++;
            } else {
                localStorage.setItem(`dashboard:${el.id}`, el.value.trim());
                updatedCount++;
            }
        });

        // Add a timestamp to force the 'storage' event even if values are exactly the same
        // This ensures the dashboard always catches the "Update" click
        localStorage.setItem('dashboard:lastUpdate', Date.now());

        // Capture exactly when the live timer was pushed so we can calculate countdown
        const timerVal = document.getElementById('liveTimer');
        if (timerVal && timerVal.value.trim() !== '') {
            const newValue = timerVal.value.trim();
            const oldValue = localStorage.getItem('dashboard:liveTimer');

            if (newValue !== oldValue) {
                // User typed a new time and hit broadcast. Clear the paused state.
                localStorage.removeItem('dashboard:timerPausedRemaining');
                localStorage.setItem('dashboard:timerStartTs', Date.now().toString());
                localStorage.setItem('dashboard:timerRunning', 'true');
            } else {
                // Keep the initial timestamp logic if it was a manual broadcast update of the same time
                if (!localStorage.getItem('dashboard:timerStartTs')) {
                    localStorage.setItem('dashboard:timerStartTs', Date.now().toString());
                }
            }
        }

        const showAnn = document.getElementById('showAnnouncement');
        if (showAnn && showAnn.checked) {
            localStorage.setItem('dashboard:announcementTimestamp', Date.now().toString());
        }

        if (updatedCount > 0) {
            showNotification('Live Dashboard Updated Successfully', 'fa-solid fa-check-circle', true);
        } else {
            showNotification('No values to update', 'fa-solid fa-circle-exclamation', false);
        }
    });

    // --- Timer Controls ---
    const btnStart = document.getElementById('btnTimerStart');
    const btnPause = document.getElementById('btnTimerPause');
    const btnReset = document.getElementById('btnTimerReset');
    const timerInput = document.getElementById('liveTimer');

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (timerInput.value.trim() !== '') {
                const newValue = timerInput.value.trim();
                const oldValue = localStorage.getItem('dashboard:liveTimer');

                // If user changed the input text before clicking start, ignore any paused state
                let pausedRemaining = localStorage.getItem('dashboard:timerPausedRemaining');
                if (newValue !== oldValue) {
                    pausedRemaining = null;
                    localStorage.removeItem('dashboard:timerPausedRemaining');
                }

                localStorage.setItem('dashboard:liveTimer', newValue);

                // If it's paused, we need to adjust the startTs back relative to now
                if (pausedRemaining) {
                    // Timer was paused. Calculate new startTs based on remaining seconds
                    const parts = timerInput.value.trim().split(':');
                    const initialH = parseInt(parts[0] || '0', 10);
                    const initialM = parseInt(parts[1] || '0', 10);
                    const initialS = parseInt(parts[2] || '0', 10);
                    const initialTotalSeconds = (initialH * 3600) + (initialM * 60) + initialS;

                    const currentRemaining = parseInt(pausedRemaining, 10);
                    const elapsedToNow = initialTotalSeconds - currentRemaining;

                    // "Backdate" the start timestamp by the elapsed amount
                    const adjustedStartTs = Date.now() - (elapsedToNow * 1000);
                    localStorage.setItem('dashboard:timerStartTs', adjustedStartTs.toString());
                    localStorage.removeItem('dashboard:timerPausedRemaining');
                } else {
                    // Fresh start
                    localStorage.setItem('dashboard:timerStartTs', Date.now().toString());
                }

                localStorage.setItem('dashboard:timerRunning', 'true');
                localStorage.setItem('dashboard:lastUpdate', Date.now().toString());
                showNotification('Timer Started', 'fa-solid fa-play', true);
            } else {
                showNotification('Please enter a timer value first', 'fa-solid fa-circle-exclamation', false);
            }
        });
    }

    if (btnPause) {
        btnPause.addEventListener('click', () => {
            const isRunning = localStorage.getItem('dashboard:timerRunning') === 'true';
            if (isRunning) {
                // To pause perfectly, we need to save the exact "currentSeconds" that script.js calculates
                // so we can resume from it later.
                const liveTimer = localStorage.getItem('dashboard:liveTimer');
                const timerStartTs = localStorage.getItem('dashboard:timerStartTs');

                if (liveTimer && timerStartTs) {
                    const parts = liveTimer.split(':');
                    const initialTotalSeconds = (parseInt(parts[0] || '0') * 3600) + (parseInt(parts[1] || '0') * 60) + parseInt(parts[2] || '0');
                    const elapsedSeconds = Math.floor((Date.now() - parseInt(timerStartTs)) / 1000);
                    let currentRemaining = initialTotalSeconds - elapsedSeconds;
                    if (currentRemaining < 0) currentRemaining = 0;

                    localStorage.setItem('dashboard:timerPausedRemaining', currentRemaining.toString());
                }

                localStorage.setItem('dashboard:timerRunning', 'false');
                localStorage.setItem('dashboard:lastUpdate', Date.now().toString());
                showNotification('Timer Paused', 'fa-solid fa-pause', true);
            }
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            timerInput.value = '24:00:00';
            localStorage.setItem('dashboard:liveTimer', '24:00:00');
            localStorage.setItem('dashboard:timerRunning', 'false');
            localStorage.removeItem('dashboard:timerStartTs');
            localStorage.removeItem('dashboard:timerPausedRemaining');
            localStorage.setItem('dashboard:lastUpdate', Date.now().toString());
            showNotification('Timer Reset', 'fa-solid fa-rotate-left', true);
        });
    }

    // Handle Reset defaults
    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all dashboard metrics to their default baseline?')) {
            for (const key in defaultData) {
                const el = document.getElementById(key);
                if (el) {
                    el.value = defaultData[key];
                    localStorage.setItem(`dashboard:${key}`, defaultData[key]);
                }
            }

            const cb = document.getElementById('resultsUnlocked');
            if (cb) {
                cb.checked = false;
                localStorage.setItem('dashboard:resultsUnlocked', 'false');
            }

            localStorage.setItem('dashboard:lastUpdate', Date.now());
            showNotification('Metrics Reset to Defaults', 'fa-solid fa-rotate-left', true);
        }
    });

    // Listen for changes in other admin tabs to keep inputs synced
    window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('dashboard:')) {
            const id = e.key.split(':')[1];
            if (id !== 'lastUpdate') {
                const input = document.getElementById(id);
                if (input && e.newValue !== null) {
                    input.value = e.newValue;
                }
            }
        }
    });
});
