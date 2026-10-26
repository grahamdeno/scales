// Scheduled reminders (1.51.0). Run by .github/workflows/remind.yml.
// Sends one web push to the phone saved in the PUSH_SUBSCRIPTION secret, signed with VAPID_PRIVATE.
// The schedule fires at two UTC hours per reminder (daylight saving and standard time); only the run that
// lands on 8 AM or 6 PM in TZ sends. A manual run sends the kind it is given.
const C = require("../../core.js");
const webpush = require("web-push");

const tz = process.env.TZ_NAME || "America/New_York";
const sub = process.env.PUSH_SUBSCRIPTION, key = process.env.VAPID_PRIVATE;

function offsetHours(zone, d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
    .formatToParts(d).map(x => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((local - d.getTime()) / 3600000);
}

const kind = process.env.KIND || C.pushSlot(process.env.SCHEDULE, offsetHours(tz, new Date()));
if (!kind) { console.log("Not the local hour for a reminder in " + tz + "; nothing sent."); process.exit(0); }
if (!key) { console.log("VAPID_PRIVATE secret is not set; nothing sent."); process.exit(0); }
webpush.setVapidDetails("https://grahamdeno.github.io/scales/", C.VAPID_PUBLIC, key);
if (!sub) { console.log("Keys are valid. PUSH_SUBSCRIPTION secret is not set; nothing sent."); process.exit(0); }

webpush.sendNotification(JSON.parse(sub), JSON.stringify({ kind }), { TTL: 3 * 3600, urgency: "normal" })
  .then(r => console.log("Sent the " + kind + " reminder (" + r.statusCode + ")."))
  .catch(e => {
    console.error("Push failed: " + (e.statusCode || "") + " " + (e.body || e.message));
    // 404 or 410: the phone dropped this subscription; turn reminders on again and save the new code.
    process.exit(1);
  });
