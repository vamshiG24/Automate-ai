import { DAYS } from "@/lib/alerts";

const field =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15";

/**
 * Frequency + time (+ weekday) picker. Times are Indian time (IST).
 * value: { frequency, time, dayOfWeek }
 */
export default function ScheduleFields({ value, onChange, idPrefix = "schedule" }) {
  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1.5 text-xs font-medium text-slate-600" htmlFor={`${idPrefix}-frequency`}>
        Repeat
        <select id={`${idPrefix}-frequency`} value={value.frequency} onChange={(event) => update({ frequency: event.target.value })} className={field}>
          <option value="daily">Every day</option>
          <option value="weekdays">Weekdays (Mon–Fri)</option>
          <option value="weekly">Once a week</option>
        </select>
      </label>

      {value.frequency === "weekly" && (
        <label className="grid gap-1.5 text-xs font-medium text-slate-600" htmlFor={`${idPrefix}-day`}>
          Day
          <select id={`${idPrefix}-day`} value={value.dayOfWeek} onChange={(event) => update({ dayOfWeek: Number(event.target.value) })} className={field}>
            {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </label>
      )}

      <label className="grid gap-1.5 text-xs font-medium text-slate-600" htmlFor={`${idPrefix}-time`}>
        Time (IST)
        <input id={`${idPrefix}-time`} type="time" value={value.time} onChange={(event) => update({ time: event.target.value })} className={field} required />
      </label>
    </div>
  );
}
