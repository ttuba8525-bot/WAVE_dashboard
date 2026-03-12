/**
 * Admin Panel Script for WAVE 3.0 Live Dashboard using Firebase
 * Handles writing to Firebase RTDB to sync data across browser tabs
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

    // Load existing values from Firebase (replaces localStorage load)
    function loadSavedData() {
        if (typeof database !== 'undefined') {
            database.ref('dashboard').once('value').then((snapshot) => {
                const data = snapshot.val() || {};
                
                for (const key in defaultData) {
                    const el = document.getElementById(key);
                    if (el) {
                        const storedVal = data[key];
                        if (el.type === 'checkbox') {
                            el.checked = storedVal === true || storedVal === 'true';
                        } else {
                            el.value = storedVal !== undefined ? storedVal : defaultData[key];
                        }
                    }
                }

                const unlocked = data.resultsUnlocked;
                const cb = document.getElementById('resultsUnlocked');
                if (cb) cb.checked = unlocked === true || unlocked === 'true';
            }).catch(error => {
                console.error("Error loading initial data from Firebase:", error);
                showNotification('Error loading initial data', 'fa-solid fa-triangle-exclamation', false);
            });
        }
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

    // Handle Form Submit (Broadcast via Firebase)
    form.addEventListener('submit', (e) => {
        e.preventDefault();

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
        
        let updates = {};
        const elements = form.querySelectorAll('input, textarea, select');

        elements.forEach(el => {
            if (el.id === 'adminPassword' || el.id === 'showAnnouncement') return; // Handled separately
            if (el.type === 'checkbox') {
                updates[el.id] = el.checked;
            } else {
                updates[el.id] = el.value.trim();
            }
        });

        const showAnn = document.getElementById('showAnnouncement');
        if (showAnn) {
             updates['showAnnouncement'] = showAnn.checked;
             if (showAnn.checked) {
                 updates['announcementTimestamp'] = Date.now().toString();
             }
        }

        // Timer specific checks inside the form submit
        const timerVal = document.getElementById('liveTimer');
        if (timerVal && timerVal.value.trim() !== '') {
             // In Firebase, we can read the old value first, but a quick broadcast just overwrites it
             // Let's ensure startTs is initialized if not present (although timer Start button is preferred)
             database.ref('dashboard/liveTimer').once('value').then((snap) => {
                  const oldValue = snap.val();
                  const newValue = timerVal.value.trim();
                  if (newValue !== oldValue) {
                        updates['timerPausedRemaining'] = null; // Clear
                        updates['timerStartTs'] = Date.now().toString();
                        updates['timerRunning'] = 'true';
                  }
                  
                  updates['lastUpdate'] = Date.now();
                  
                  // Push to Firebase
                  database.ref('dashboard').update(updates).then(() => {
                      showNotification('Live Dashboard Updated Globally', 'fa-solid fa-check-circle', true);
                  }).catch(error => {
                      showNotification('Error updating dashboard: ' + error.message, 'fa-solid fa-circle-exclamation', false);
                  });
             });
        } else {
            updates['lastUpdate'] = Date.now();
            database.ref('dashboard').update(updates).then(() => {
                showNotification('Live Dashboard Updated Globally', 'fa-solid fa-check-circle', true);
            }).catch(error => {
                showNotification('Error updating dashboard: ' + error.message, 'fa-solid fa-circle-exclamation', false);
            });
        }
    });

    // --- Timer Controls (Firebase adapted) ---
    // Timer controls need to fetch the current snapshot to do math, then push updates
    
    function updateFirebaseTimer(updatesDict, successMsg, errorMsg) {
        updatesDict['lastUpdate'] = Date.now().toString();
        database.ref('dashboard').update(updatesDict).then(() => {
            showNotification(successMsg, 'fa-solid fa-check', true);
        }).catch(err => {
            showNotification(errorMsg || 'Database error', 'fa-solid fa-circle-exclamation', false);
        });
    }

    const btnStart = document.getElementById('btnTimerStart');
    const btnPause = document.getElementById('btnTimerPause');
    const btnReset = document.getElementById('btnTimerReset');
    const timerInput = document.getElementById('liveTimer');

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (timerInput.value.trim() !== '') {
                const newValue = timerInput.value.trim();
                
                database.ref('dashboard').once('value').then(snap => {
                    const data = snap.val() || {};
                    const oldValue = data.liveTimer;
                    let pausedRemaining = data.timerPausedRemaining;
                    
                    let updates = { liveTimer: newValue, timerRunning: 'true' };

                    if (newValue !== oldValue) {
                        pausedRemaining = null;
                        updates['timerPausedRemaining'] = null;
                    }

                    if (pausedRemaining) {
                        const parts = timerInput.value.trim().split(':');
                        const initialH = parseInt(parts[0] || '0', 10);
                        const initialM = parseInt(parts[1] || '0', 10);
                        const initialS = parseInt(parts[2] || '0', 10);
                        const initialTotalSeconds = (initialH * 3600) + (initialM * 60) + initialS;

                        const currentRemaining = parseInt(pausedRemaining, 10);
                        const elapsedToNow = initialTotalSeconds - currentRemaining;

                        const adjustedStartTs = Date.now() - (elapsedToNow * 1000);
                        updates['timerStartTs'] = adjustedStartTs.toString();
                        updates['timerPausedRemaining'] = null;
                    } else {
                        updates['timerStartTs'] = Date.now().toString();
                    }

                    updateFirebaseTimer(updates, 'Timer Started', 'Failed to start timer');
                });
            } else {
                showNotification('Please enter a timer value first', 'fa-solid fa-circle-exclamation', false);
            }
        });
    }

    if (btnPause) {
        btnPause.addEventListener('click', () => {
             database.ref('dashboard').once('value').then(snap => {
                 const data = snap.val() || {};
                 if (data.timerRunning === 'true' || data.timerRunning === true) {
                     const liveTimer = data.liveTimer;
                     const timerStartTs = data.timerStartTs;
                     
                     let updates = { timerRunning: 'false' };
                     
                     if (liveTimer && timerStartTs) {
                         const parts = liveTimer.split(':');
                         const initialTotalSeconds = (parseInt(parts[0] || '0') * 3600) + (parseInt(parts[1] || '0') * 60) + parseInt(parts[2] || '0');
                         const elapsedSeconds = Math.floor((Date.now() - parseInt(timerStartTs)) / 1000);
                         let currentRemaining = initialTotalSeconds - elapsedSeconds;
                         if (currentRemaining < 0) currentRemaining = 0;
                         
                         updates['timerPausedRemaining'] = currentRemaining.toString();
                     }
                     
                     updateFirebaseTimer(updates, 'Timer Paused', 'Failed to pause timer');
                 }
             });
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            timerInput.value = '24:00:00';
            updateFirebaseTimer({
                 liveTimer: '24:00:00',
                 timerRunning: 'false',
                 timerStartTs: null,
                 timerPausedRemaining: null
            }, 'Timer Reset', 'Failed to reset timer');
        });
    }

    // Handle Reset defaults
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all dashboard metrics to their default baseline globally?')) {
                let updates = { ...defaultData, resultsUnlocked: false, lastUpdate: Date.now() };
                
                database.ref('dashboard').set(updates).then(() => {
                    // Update local UI
                    for (const key in defaultData) {
                        const el = document.getElementById(key);
                        if (el) {
                            if (el.type !== 'checkbox') el.value = defaultData[key];
                        }
                    }
                    const cb = document.getElementById('resultsUnlocked');
                    if (cb) cb.checked = false;
                    
                    showNotification('Metrics Reset to Defaults Globally', 'fa-solid fa-rotate-left', true);
                }).catch(err => {
                    showNotification('Failed to reset defaults', 'fa-solid fa-circle-exclamation', false);
                });
            }
        });
    }

    // Listen for real-time changes from OTHER admins or initial sync dynamically
    if (typeof database !== 'undefined') {
        database.ref('dashboard').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Update text inputs that aren't actively being typed in
                for (const key in data) {
                    const el = document.getElementById(key);
                    if (el && document.activeElement !== el) {
                        if (el.type === 'checkbox') {
                            el.checked = data[key] === true || data[key] === 'true';
                        } else {
                            el.value = data[key];
                        }
                    }
                }
            }
        });
    }
});
