/**
 * Medicine Reminder System (Thoughtful Edition)
 * ------------------------------------------------
 * Caring features: repeat days, early warning, streak, weekly chart,
 * backup, quiet hours, pause, duplicate check, gentle sound.
 */

const STORAGE_KEY = "medicineReminders";
const THEME_KEY = "medicineReminderTheme";
const SETTINGS_KEY = "medicineReminderSettings";
const CHECK_INTERVAL_MS = 10000;
const SNOOZE_MINUTES = 5;

const MOTIVATION_TIPS = [
    "Small daily habits build lasting health.",
    "Taking medicine on time is an act of self-care.",
    "You're doing great by staying consistent.",
    "Health is wealth — keep going!",
    "One dose at a time makes a big difference.",
];

let alertedToday = {};
let preAlertedToday = {};
let snoozedUntil = {};
let activeModalId = null;

// ---------- DOM ----------
const form = document.getElementById("reminderForm");
const formTitle = document.getElementById("formTitle");
const editIdInput = document.getElementById("editId");
const nameInput = document.getElementById("medicineName");
const dosageInput = document.getElementById("dosage");
const timeInput = document.getElementById("reminderTime");
const notesInput = document.getElementById("notes");
const daysRow = document.getElementById("daysRow");
const weekdaysOnlyBtn = document.getElementById("weekdaysOnlyBtn");
const nameError = document.getElementById("nameError");
const timeError = document.getElementById("timeError");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const reminderList = document.getElementById("reminderList");
const emptyMessage = document.getElementById("emptyMessage");
const reminderCount = document.getElementById("reminderCount");
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");
const nextDoseText = document.getElementById("nextDoseText");
const motivationText = document.getElementById("motivationText");
const streakBanner = document.getElementById("streakBanner");
const streakText = document.getElementById("streakText");
const weekDots = document.getElementById("weekDots");
const wellnessHint = document.getElementById("wellnessHint");
const themeToggle = document.getElementById("themeToggle");
const enableNotifyBtn = document.getElementById("enableNotifyBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const toastContainer = document.getElementById("toastContainer");
const reminderModal = document.getElementById("reminderModal");
const modalMedicineName = document.getElementById("modalMedicineName");
const modalDosage = document.getElementById("modalDosage");
const modalTakenBtn = document.getElementById("modalTakenBtn");
const modalSnoozeBtn = document.getElementById("modalSnoozeBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const preReminderMins = document.getElementById("preReminderMins");
const soundEnabled = document.getElementById("soundEnabled");
const quietHoursEnabled = document.getElementById("quietHoursEnabled");
const quietStart = document.getElementById("quietStart");
const quietEnd = document.getElementById("quietEnd");
const statTotal = document.getElementById("statTotal");
const statUpcoming = document.getElementById("statUpcoming");
const statTaken = document.getElementById("statTaken");
const statMissed = document.getElementById("statMissed");

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------- Settings ----------

function getSettings() {
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
        return {
            preReminderMinutes: s.preReminderMinutes ?? 5,
            soundEnabled: s.soundEnabled !== false,
            quietHoursEnabled: !!s.quietHoursEnabled,
            quietStart: s.quietStart || "22:00",
            quietEnd: s.quietEnd || "07:00",
        };
    } catch (e) {
        return { preReminderMinutes: 5, soundEnabled: true, quietHoursEnabled: false, quietStart: "22:00", quietEnd: "07:00" };
    }
}

function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettingsUI() {
    const s = getSettings();
    preReminderMins.value = String(s.preReminderMinutes);
    soundEnabled.checked = s.soundEnabled;
    quietHoursEnabled.checked = s.quietHoursEnabled;
    quietStart.value = s.quietStart;
    quietEnd.value = s.quietEnd;
}

function readSettingsFromUI() {
    const settings = {
        preReminderMinutes: parseInt(preReminderMins.value, 10) || 0,
        soundEnabled: soundEnabled.checked,
        quietHoursEnabled: quietHoursEnabled.checked,
        quietStart: quietStart.value,
        quietEnd: quietEnd.value,
    };
    saveSettings(settings);
    return settings;
}

// ---------- Storage ----------

function getReminders() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data).map(migrateReminder);
    } catch (e) {
        return [];
    }
}

function migrateReminder(item) {
    return {
        id: item.id,
        name: item.name || "",
        time: item.time || "08:00",
        dosage: item.dosage || "",
        notes: item.notes || "",
        takenDates: Array.isArray(item.takenDates) ? item.takenDates : [],
        days: Array.isArray(item.days) && item.days.length ? item.days : [0, 1, 2, 3, 4, 5, 6],
        paused: !!item.paused,
    };
}

function saveReminders(reminders) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Date / time ----------

function getTodayKey() {
    const n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
}

function getDateKeyFromDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function getCurrentTimeString() {
    const n = new Date();
    return String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0");
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTimeString(mins) {
    if (mins < 0) mins += 24 * 60;
    if (mins >= 24 * 60) mins -= 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function formatTimeDisplay(time24) {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return h12 + ":" + String(minutes).padStart(2, "0") + " " + period;
}

function isScheduledToday(item, dateKey) {
    if (item.paused) return false;
    const d = dateKey ? new Date(dateKey + "T12:00:00") : new Date();
    const day = d.getDay();
    return item.days.includes(day);
}

function isTakenOnDate(item, dateKey) {
    return item.takenDates.includes(dateKey);
}

function isTakenToday(item) {
    return isTakenOnDate(item, getTodayKey());
}

function getActiveRemindersForDate(dateKey) {
    return getReminders().filter(function (r) {
        return isScheduledToday(r, dateKey);
    });
}

function getReminderStatus(item) {
    if (!isScheduledToday(item)) return "off";
    if (item.paused) return "paused";
    if (isTakenToday(item)) return "taken";

    const nowMins = timeToMinutes(getCurrentTimeString());
    const remMins = timeToMinutes(item.time);

    if (remMins > nowMins) return "upcoming";
    if (remMins === nowMins) return "due";
    return "missed";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatDaysShort(days) {
    if (days.length === 7) return "Every day";
    if (days.length === 5 && [1, 2, 3, 4, 5].every(function (d) { return days.includes(d); })) {
        return "Weekdays";
    }
    return days.sort(function (a, b) { return a - b; }).map(function (d) { return DAY_NAMES[d]; }).join(", ");
}

// ---------- Quiet hours ----------

function isQuietHoursNow() {
    const s = getSettings();
    if (!s.quietHoursEnabled) return false;

    const now = timeToMinutes(getCurrentTimeString());
    const start = timeToMinutes(s.quietStart);
    const end = timeToMinutes(s.quietEnd);

    if (start < end) {
        return now >= start && now < end;
    }
    return now >= start || now < end;
}

// ---------- Sound (Web Audio - no external file) ----------

function playGentleChime() {
    if (!getSettings().soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 523.25;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
    } catch (e) { /* ignore */ }
}

// ---------- Toast ----------

function showToast(message, type) {
    const el = document.createElement("div");
    el.className = "toast " + (type || "info");
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(function () { el.remove(); }, 4000);
}

// ---------- Form: days ----------

function getSelectedDays() {
    const boxes = daysRow.querySelectorAll('input[type="checkbox"]');
    const selected = [];
    boxes.forEach(function (cb) {
        if (cb.checked) selected.push(parseInt(cb.value, 10));
    });
    return selected;
}

function setSelectedDays(days) {
    daysRow.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = days.includes(parseInt(cb.value, 10));
    });
}

function setAllDaysChecked(checked) {
    daysRow.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = checked;
    });
}

// ---------- Validation ----------

function validateForm() {
    let ok = true;
    nameError.textContent = "";
    timeError.textContent = "";
    nameInput.classList.remove("invalid");
    timeInput.classList.remove("invalid");

    if (nameInput.value.trim() === "") {
        nameError.textContent = "Please enter medicine name.";
        nameInput.classList.add("invalid");
        ok = false;
    }
    if (timeInput.value === "") {
        timeError.textContent = "Please select time.";
        timeInput.classList.add("invalid");
        ok = false;
    }
    if (getSelectedDays().length === 0) {
        showToast("Select at least one day for the reminder.", "warning");
        ok = false;
    }

    if (ok && !editIdInput.value) {
        const dup = getReminders().find(function (r) {
            return r.name.toLowerCase() === nameInput.value.trim().toLowerCase() &&
                r.time === timeInput.value &&
                !r.paused;
        });
        if (dup) {
            if (!confirm("You already have this medicine at the same time. Add anyway?")) {
                ok = false;
            }
        }
    }

    return ok;
}

// ---------- CRUD ----------

function addOrUpdateReminder() {
    const name = nameInput.value.trim();
    const time = timeInput.value;
    const dosage = dosageInput.value.trim();
    const notes = notesInput.value.trim();
    const days = getSelectedDays();
    const editId = editIdInput.value;
    let reminders = getReminders();

    if (editId) {
        reminders = reminders.map(function (r) {
            if (r.id === editId) {
                return { ...r, name, time, dosage, notes, days };
            }
            return r;
        });
        showToast("Reminder updated!", "success");
        resetForm();
    } else {
        reminders.push({
            id: generateId(),
            name, time, dosage, notes, days,
            takenDates: [],
            paused: false,
        });
        showToast("Reminder added! We'll care for your schedule.", "success");
        form.reset();
        setAllDaysChecked(true);
    }

    saveReminders(reminders);
    renderAll();
}

function deleteReminder(id) {
    if (!confirm("Delete this reminder?")) return;
    saveReminders(getReminders().filter(function (r) { return r.id !== id; }));
    showToast("Reminder removed.", "warning");
    renderAll();
}

function togglePause(id) {
    const reminders = getReminders().map(function (r) {
        if (r.id === id) {
            r.paused = !r.paused;
            showToast(r.paused ? "Reminder paused." : "Reminder resumed.", "info");
        }
        return r;
    });
    saveReminders(reminders);
    renderAll();
}

function markAsTaken(id) {
    const today = getTodayKey();
    const reminders = getReminders().map(function (r) {
        if (r.id !== id) return r;
        if (!r.takenDates.includes(today)) r.takenDates.push(today);
        return r;
    });
    saveReminders(reminders);
    closeModal();
    showToast("Well done! Marked as taken today.", "success");
    renderAll();
}

function startEdit(item) {
    editIdInput.value = item.id;
    nameInput.value = item.name;
    dosageInput.value = item.dosage || "";
    timeInput.value = item.time;
    notesInput.value = item.notes || "";
    setSelectedDays(item.days);
    formTitle.textContent = "Edit Reminder";
    submitBtn.textContent = "Save Changes";
    cancelEditBtn.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
    editIdInput.value = "";
    form.reset();
    setAllDaysChecked(true);
    formTitle.textContent = "Add New Reminder";
    submitBtn.textContent = "Add Reminder";
    cancelEditBtn.classList.add("hidden");
}

// ---------- Wellness: streak & weekly chart ----------

function getDayAdherence(dateKey) {
    const active = getActiveRemindersForDate(dateKey);
    if (active.length === 0) return "none";

    const allTaken = active.every(function (r) { return isTakenOnDate(r, dateKey); });
    if (allTaken) return "complete";

    const today = getTodayKey();
    if (dateKey === today) return "partial";

    if (dateKey < today) return "missed";
    return "partial";
}

function calculateStreak() {
    let streak = 0;
    const d = new Date();

    for (let i = 0; i < 365; i++) {
        const check = new Date(d);
        check.setDate(d.getDate() - i);
        const key = getDateKeyFromDate(check);
        const status = getDayAdherence(key);

        if (status === "none") continue;
        if (status === "complete") {
            streak++;
        } else if (i === 0 && status === "partial") {
            continue;
        } else {
            break;
        }
    }
    return streak;
}

function renderWeeklyChart() {
    const labels = [];
    const dots = [];
    const today = getTodayKey();

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = getDateKeyFromDate(d);
        const status = getDayAdherence(key);
        const isToday = key === today;

        labels.push(DAY_NAMES[d.getDay()]);
        const symbol = status === "complete" ? "✓" : status === "missed" ? "!" : status === "partial" ? "…" : "–";
        dots.push(
            '<div class="week-day">' +
            '<span class="week-day-label">' + labels[labels.length - 1] + '</span>' +
            '<div class="week-dot ' + status + (isToday ? " today" : "") + '" title="' + key + ': ' + status + '">' + symbol + '</div>' +
            '</div>'
        );
    }

    weekDots.innerHTML = dots.join("");

    const completeDays = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (getDayAdherence(getDateKeyFromDate(d)) === "complete") completeDays.push(1);
    }
    wellnessHint.textContent = completeDays.length >= 5
        ? "Strong week! Keep your routine going."
        : "Green dots = all medicines taken that day.";
}

function renderStreak() {
    const streak = calculateStreak();
    if (streak > 0) {
        streakBanner.classList.remove("hidden");
        streakText.textContent = streak === 1
            ? "1 day streak — great start!"
            : streak + " day streak — you're building a healthy habit!";
    } else {
        streakBanner.classList.add("hidden");
    }
}

function showMotivation() {
    const tip = MOTIVATION_TIPS[Math.floor(Math.random() * MOTIVATION_TIPS.length)];
    motivationText.textContent = "💡 " + tip;
}

// ---------- Render list ----------

function getFilteredReminders() {
    let list = getReminders().filter(function (r) { return isScheduledToday(r) || r.paused; });
    const q = searchInput.value.trim().toLowerCase();
    const filter = filterSelect.value;

    if (q) {
        list = list.filter(function (r) {
            return r.name.toLowerCase().includes(q) || (r.dosage && r.dosage.toLowerCase().includes(q));
        });
    }

    if (filter !== "all") {
        list = list.filter(function (r) {
            const status = getReminderStatus(r);
            if (filter === "upcoming") return status === "upcoming" || status === "due";
            if (filter === "taken") return status === "taken";
            if (filter === "missed") return status === "missed";
            return true;
        });
    }

    list.sort(function (a, b) {
        if (a.paused !== b.paused) return a.paused ? 1 : -1;
        return timeToMinutes(a.time) - timeToMinutes(b.time);
    });

    return list;
}

function renderReminders() {
    const reminders = getFilteredReminders();
    reminderCount.textContent = getReminders().filter(function (r) { return !r.paused; }).length;

    if (reminders.length === 0) {
        const hasAny = getReminders().length > 0;
        emptyMessage.textContent = hasAny
            ? "No reminders match your search or filter."
            : "No reminders yet. Add your first medicine above.";
        emptyMessage.classList.remove("hidden");
        reminderList.innerHTML = "";
        return;
    }

    emptyMessage.classList.add("hidden");

    reminderList.innerHTML = reminders.map(function (item) {
        const status = getReminderStatus(item);
        const statusLabel = item.paused ? "Paused" :
            status === "off" ? "Not today" :
            status === "taken" ? "Taken" :
            status === "missed" ? "Missed" :
            status === "due" ? "Due Now" : "Upcoming";

        let meta = formatTimeDisplay(item.time);
        if (item.dosage) meta += " · " + escapeHtml(item.dosage);
        if (item.notes) meta += "<br><em>" + escapeHtml(item.notes) + "</em>";
        meta += '<div class="days-badge">📅 ' + formatDaysShort(item.days) + "</div>";

        const takenBtn = status !== "taken" && status !== "off" && !item.paused
            ? '<button type="button" class="btn-taken" data-action="taken" data-id="' + item.id + '">✓ Taken</button>'
            : "";

        const pauseLabel = item.paused ? "Resume" : "Pause";

        return (
            '<li class="reminder-item status-' + status + (item.paused ? " paused" : "") + '">' +
            '<div class="reminder-row">' +
            '<div><div class="reminder-name">' + escapeHtml(item.name) + '</div>' +
            '<div class="reminder-meta">' + meta + '</div></div>' +
            '<span class="status-tag ' + status + '">' + statusLabel + '</span></div>' +
            '<div class="reminder-time">⏰ ' + item.time + '</div>' +
            '<div class="reminder-actions">' + takenBtn +
            '<button type="button" class="btn-pause" data-action="pause" data-id="' + item.id + '">' + pauseLabel + '</button>' +
            '<button type="button" class="btn-edit" data-action="edit" data-id="' + item.id + '">Edit</button>' +
            '<button type="button" class="btn-delete" data-action="delete" data-id="' + item.id + '">Delete</button>' +
            '</div></li>'
        );
    }).join("");

    reminderList.querySelectorAll("[data-action]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const id = btn.getAttribute("data-id");
            const action = btn.getAttribute("data-action");
            const item = getReminders().find(function (r) { return r.id === id; });
            if (action === "delete") deleteReminder(id);
            if (action === "edit" && item) startEdit(item);
            if (action === "taken") markAsTaken(id);
            if (action === "pause") togglePause(id);
        });
    });
}

function updateStats() {
    const todayActive = getActiveRemindersForDate(getTodayKey());
    let upcoming = 0, taken = 0, missed = 0;

    todayActive.forEach(function (r) {
        const s = getReminderStatus(r);
        if (s === "taken") taken++;
        else if (s === "missed") missed++;
        else if (s !== "off" && s !== "paused") upcoming++;
    });

    statTotal.textContent = todayActive.length;
    statUpcoming.textContent = upcoming;
    statTaken.textContent = taken;
    statMissed.textContent = missed;
}

function updateNextDose() {
    const all = getActiveRemindersForDate(getTodayKey()).filter(function (r) {
        return getReminderStatus(r) !== "taken" && !r.paused;
    });

    if (all.length === 0) {
        nextDoseText.textContent = getReminders().length
            ? "All today's medicines done — proud of you!"
            : "Add a reminder to see your next dose.";
        return;
    }

    const nowMins = timeToMinutes(getCurrentTimeString());
    let next = null;
    let minDiff = Infinity;

    all.forEach(function (r) {
        let diff = timeToMinutes(r.time) - nowMins;
        if (diff < 0) diff += 24 * 60;
        if (diff < minDiff) { minDiff = diff; next = r; }
    });

    const hrs = Math.floor(minDiff / 60);
    const mins = minDiff % 60;
    let countdown = mins + " min";
    if (hrs > 0) countdown = hrs + " hr " + mins + " min";

    nextDoseText.textContent = "Next: " + next.name + " at " + formatTimeDisplay(next.time) + " (~" + countdown + ")";
}

function renderAll() {
    renderReminders();
    updateStats();
    updateNextDose();
    renderWeeklyChart();
    renderStreak();
}

// ---------- Backup ----------

function exportBackup() {
    const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        reminders: getReminders(),
        settings: getSettings(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "medicine-reminder-backup-" + getTodayKey() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Backup downloaded.", "success");
}

function importBackup(file) {
    const reader = new FileReader();
    reader.onload = function () {
        try {
            const data = JSON.parse(reader.result);
            if (!data.reminders || !Array.isArray(data.reminders)) {
                throw new Error("Invalid file");
            }
            if (!confirm("Import will replace your current reminders. Continue?")) return;
            saveReminders(data.reminders.map(migrateReminder));
            if (data.settings) saveSettings(data.settings);
            loadSettingsUI();
            showToast("Backup restored successfully!", "success");
            renderAll();
        } catch (e) {
            showToast("Could not read backup file.", "warning");
        }
    };
    reader.readAsText(file);
}

// ---------- Alerts ----------

function showReminderAlert(item, isEarly) {
    if (isQuietHoursNow()) return;

    activeModalId = item.id;
    const prefix = isEarly ? "Coming up in " + getSettings().preReminderMinutes + " min: " : "";
    modalMedicineName.textContent = prefix + item.name;
    modalDosage.textContent = item.dosage ? "Dosage: " + item.dosage : (item.notes || "Take your medicine on time.");

    if (!isEarly) {
        reminderModal.classList.remove("hidden");
        playGentleChime();
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Medicine Reminder", { body: "Time to take: " + item.name });
        }
        alert("💊 Medicine Reminder\n\nIt's time to take: " + item.name);
    } else {
        showToast("⏳ " + prefix + item.name, "info");
        playGentleChime();
    }
}

function closeModal() {
    reminderModal.classList.add("hidden");
    activeModalId = null;
}

function snoozeReminder(id) {
    snoozedUntil[id] = Date.now() + SNOOZE_MINUTES * 60 * 1000;
    closeModal();
    showToast("Snoozed " + SNOOZE_MINUTES + " min. We'll remind you again.", "info");
}

function checkReminders() {
    if (isQuietHoursNow()) return;

    const currentTime = getCurrentTimeString();
    const today = getTodayKey();
    const now = Date.now();
    const settings = getSettings();
    const preMins = settings.preReminderMinutes || 0;
    const preTime = preMins > 0 ? minutesToTimeString(timeToMinutes(currentTime) + preMins) : null;

    getReminders().forEach(function (item) {
        if (!isScheduledToday(item) || item.paused || isTakenToday(item)) return;

        if (snoozedUntil[item.id] && now < snoozedUntil[item.id]) return;
        if (snoozedUntil[item.id]) delete snoozedUntil[item.id];

        if (preTime && item.time === preTime) {
            const preKey = "pre-" + item.id + "-" + today;
            if (!preAlertedToday[preKey]) {
                preAlertedToday[preKey] = true;
                showReminderAlert(item, true);
            }
        }

        if (item.time !== currentTime) return;

        const alertKey = item.id + "-" + today;
        if (alertedToday[alertKey]) return;

        alertedToday[alertKey] = true;
        showReminderAlert(item, false);
    });

    renderAll();
}

// ---------- Theme ----------

function loadTheme() {
    if (localStorage.getItem(THEME_KEY) === "dark") {
        document.body.classList.add("dark-theme");
        themeToggle.textContent = "☀️";
    }
}

function toggleTheme() {
    document.body.classList.toggle("dark-theme");
    const isDark = document.body.classList.contains("dark-theme");
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    themeToggle.textContent = isDark ? "☀️" : "🌙";
}

// ---------- Events ----------

form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateForm()) return;
    addOrUpdateReminder();
});

cancelEditBtn.addEventListener("click", resetForm);
weekdaysOnlyBtn.addEventListener("click", function () {
    setSelectedDays([1, 2, 3, 4, 5]);
});

nameInput.addEventListener("input", function () {
    nameInput.classList.remove("invalid");
    nameError.textContent = "";
});

timeInput.addEventListener("input", function () {
    timeInput.classList.remove("invalid");
    timeError.textContent = "";
});

searchInput.addEventListener("input", renderReminders);
filterSelect.addEventListener("change", renderReminders);

[preReminderMins, soundEnabled, quietHoursEnabled, quietStart, quietEnd].forEach(function (el) {
    el.addEventListener("change", function () {
        readSettingsFromUI();
        showToast("Settings saved.", "success");
    });
});

themeToggle.addEventListener("click", toggleTheme);

enableNotifyBtn.addEventListener("click", function () {
    if (!("Notification" in window)) {
        showToast("Notifications not supported in this browser.", "warning");
        return;
    }
    Notification.requestPermission().then(function (perm) {
        if (perm === "granted") {
            showToast("Notifications enabled!", "success");
            enableNotifyBtn.textContent = "🔔 Alerts On";
        }
    });
});

clearAllBtn.addEventListener("click", function () {
    if (!confirm("Delete ALL reminders? Export backup first if needed.")) return;
    saveReminders([]);
    resetForm();
    showToast("All reminders cleared.", "warning");
    renderAll();
});

exportBtn.addEventListener("click", exportBackup);
importFile.addEventListener("change", function () {
    if (importFile.files[0]) importBackup(importFile.files[0]);
    importFile.value = "";
});

modalTakenBtn.addEventListener("click", function () {
    if (activeModalId) markAsTaken(activeModalId);
});
modalSnoozeBtn.addEventListener("click", function () {
    if (activeModalId) snoozeReminder(activeModalId);
});
modalCloseBtn.addEventListener("click", closeModal);

// ---------- Init ----------

loadTheme();
loadSettingsUI();
showMotivation();
renderAll();
checkReminders();
setInterval(checkReminders, CHECK_INTERVAL_MS);
setInterval(updateNextDose, 60000);
