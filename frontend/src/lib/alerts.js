// Approval alerts: a short chime + an in-app pop-up, or a desktop notification
// when the page is out of view. The on/off preference is per device, so it lives in localStorage.
import { toast } from "sonner";

const PREF_KEY = "automate.approvalAlerts";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const alertsEnabled = () => {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
};

export const setAlertsEnabled = (enabled) => {
  try {
    localStorage.setItem(PREF_KEY, enabled ? "on" : "off");
  } catch {
    // Storage blocked: the setting just won't be remembered
  }
};

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

// Must be called from a click (browsers only allow permission prompts then)
export const requestNotificationPermission = async () => {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
};

let audioContext;

const getAudioContext = () => {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  // Browsers start audio "suspended" until the page has been clicked
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
};

// Called on the user's first click: browsers only allow sound and the
// notification permission prompt after a click on the page.
export const unlockAlerts = () => {
  try {
    getAudioContext();
  } catch {
    // No Web Audio: alerts stay silent
  }
  if (alertsEnabled() && notificationsSupported() && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
};

// Two soft rising notes, generated in code (no sound file needed)
export const playChime = () => {
  try {
    getAudioContext();
    const start = audioContext.currentTime;

    [660, 880].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + index * 0.16;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.3);
    });
  } catch {
    // Audio can be blocked until the user has clicked the page
  }
};

// The user can't see the page: another tab, a minimised window or another app in front
const pageOutOfView = () => document.hidden || !document.hasFocus();

/**
 * Alert the user that an action is waiting for approval.
 * In view: chime + in-app pop-up. Out of view: chime + desktop notification
 * (falls back to the pop-up if notifications aren't allowed).
 * `force` shows both (used by the "Send test alert" button).
 */
export const alertApprovalNeeded = ({ title, body, onClick, tag = "automate-approval", force = false }) => {
  if (!alertsEnabled() && !force) return;

  playChime();

  const canNotify = notificationsSupported() && Notification.permission === "granted";

  if (force || !pageOutOfView() || !canNotify) {
    toast.warning(title, {
      id: tag,
      description: body,
      duration: 10000,
      action: onClick ? { label: "Open", onClick } : undefined,
    });
  }

  if (canNotify && (force || pageOutOfView())) {
    // renotify: pop up again even if an older alert with the same tag is still listed
    const notification = new Notification(title, { body, tag, renotify: true, requireInteraction: true });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  }
};

// Human-readable schedule, e.g. "Every weekday at 8:00 AM"
export const describeSchedule = ({ frequency, time, dayOfWeek }) => {
  const [hours, minutes] = time.split(":").map(Number);
  const clock = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (frequency === "weekdays") return `Every weekday at ${clock}`;
  if (frequency === "weekly") return `Every ${DAYS[dayOfWeek]} at ${clock}`;
  return `Every day at ${clock}`;
};
