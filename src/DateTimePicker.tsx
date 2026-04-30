import { useState, useRef, useEffect } from 'react';
import './DateTimePicker.css';

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DOW = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const RING_OUTER = 88;
const RING_INNER = 62;

function pad2(n: number) { return String(n).padStart(2, '0'); }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function wrap(n: number, size: number) { return ((n % size) + size) % size; }
function onlyDigits(s: string) { return s.replace(/\D/g, ''); }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }

function parseInputStr(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  return new Date();
}

function toInputStr(d: Date): string {
  return `${d.getFullYear().toString().padStart(4, '0')}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDisplay(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type Mode = 'hour' | 'minute';
type DatePart = 'day' | 'month' | 'year';

interface PS {
  date: Date;
  mode: Mode;
  part: DatePart;
  calY: number;
  calM: number;
}

// ---- PickerPanel ----

export interface PickerPanelProps {
  initial: Date;
  onConfirm(d: Date): void;
  onCancel(): void;
}

export function PickerPanel({ initial, onConfirm, onCancel }: PickerPanelProps) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [ps, setPs] = useState<PS>({
    date: new Date(initial),
    mode: 'hour',
    part: 'day',
    calY: initial.getFullYear(),
    calM: initial.getMonth(),
  });

  const suppressBlur = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const ddRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const yyyyRef = useRef<HTMLInputElement>(null);
  const hhRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);

  // Sync non-focused inputs when state changes
  useEffect(() => {
    const sync = (ref: React.RefObject<HTMLInputElement | null>, val: string) => {
      if (ref.current && document.activeElement !== ref.current) ref.current.value = val;
    };
    sync(ddRef, pad2(ps.date.getDate()));
    sync(mmRef, pad2(ps.date.getMonth() + 1));
    sync(yyyyRef, ps.date.getFullYear().toString().padStart(4, '0'));
    sync(hhRef, pad2(ps.date.getHours()));
    sync(minRef, pad2(ps.date.getMinutes()));
  }, [ps.date]);

  // ---- mutators ----

  function bumpDay(delta: number) {
    setPs(p => {
      const d = new Date(p.date); d.setDate(d.getDate() + delta);
      return { ...p, date: d, part: 'day', calY: d.getFullYear(), calM: d.getMonth() };
    });
  }

  function bumpMonth(delta: number) {
    setPs(p => {
      const y = p.date.getFullYear(), m = p.date.getMonth() + delta;
      const day = clamp(p.date.getDate(), 1, daysInMonth(y, m));
      const d = new Date(y, m, day, p.date.getHours(), p.date.getMinutes());
      return { ...p, date: d, part: 'month', calY: d.getFullYear(), calM: d.getMonth() };
    });
  }

  function bumpYear(delta: number) {
    setPs(p => {
      const y = clamp(p.date.getFullYear() + delta, 1, 9999), m = p.date.getMonth();
      const day = clamp(p.date.getDate(), 1, daysInMonth(y, m));
      const d = new Date(y, m, day, p.date.getHours(), p.date.getMinutes());
      return { ...p, date: d, part: 'year', calY: y, calM: m };
    });
  }

  function bumpHour(delta: number) {
    setPs(p => {
      const d = new Date(p.date); d.setHours(wrap(d.getHours() + delta, 24));
      return { ...p, date: d, mode: 'hour' };
    });
  }

  function bumpMinute(delta: number) {
    setPs(p => {
      const d = new Date(p.date); d.setMinutes(wrap(d.getMinutes() + delta, 60));
      return { ...p, date: d, mode: 'minute' };
    });
  }

  function setHour(h: number) {
    setPs(p => {
      const d = new Date(p.date); d.setHours(wrap(h, 24));
      return { ...p, date: d, mode: 'minute' };
    });
  }

  function setMinute(m: number) {
    setPs(p => {
      const d = new Date(p.date); d.setMinutes(wrap(m, 60));
      return { ...p, date: d };
    });
  }

  function setDatePartFromInput(part: DatePart, raw: string) {
    const n = parseInt(onlyDigits(raw), 10);
    if (isNaN(n)) return;
    setPs(p => {
      const y = p.date.getFullYear(), m = p.date.getMonth(), day = p.date.getDate();
      const h = p.date.getHours(), min = p.date.getMinutes();
      let next: Date;
      if (part === 'day') {
        next = new Date(y, m, clamp(n, 1, daysInMonth(y, m)), h, min);
      } else if (part === 'month') {
        const nm = clamp(n, 1, 12) - 1;
        next = new Date(y, nm, clamp(day, 1, daysInMonth(y, nm)), h, min);
      } else {
        const ny = clamp(n, 1, 9999);
        next = new Date(ny, m, clamp(day, 1, daysInMonth(ny, m)), h, min);
      }
      return { ...p, date: next, part, calY: next.getFullYear(), calM: next.getMonth() };
    });
  }

  function setTimePartFromInput(mode: Mode, raw: string) {
    const n = parseInt(onlyDigits(raw), 10);
    if (isNaN(n)) return;
    setPs(p => {
      const d = new Date(p.date);
      if (mode === 'hour') d.setHours(clamp(n, 0, 23));
      else d.setMinutes(clamp(n, 0, 59));
      return { ...p, date: d, mode };
    });
  }

  function commitActiveField() {
    const a = document.activeElement;
    if (a === ddRef.current) setDatePartFromInput('day', ddRef.current!.value);
    else if (a === mmRef.current) setDatePartFromInput('month', mmRef.current!.value);
    else if (a === yyyyRef.current) setDatePartFromInput('year', yyyyRef.current!.value);
    else if (a === hhRef.current) setTimePartFromInput('hour', hhRef.current!.value);
    else if (a === minRef.current) setTimePartFromInput('minute', minRef.current!.value);
  }

  function focusClockAfterPointer() {
    requestAnimationFrame(() => {
      svgRef.current?.focus({ preventScroll: true });
      setTimeout(() => { suppressBlur.current = false; }, 0);
    });
  }

  // ---- SVG clock pointer handler ----

  function handleSvgPointerDown(ev: React.PointerEvent<SVGSVGElement>) {
    ev.preventDefault();
    suppressBlur.current = true;
    commitActiveField();
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const lp = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const r = Math.hypot(lp.x, lp.y);
    if (r > 104) { suppressBlur.current = false; return; }
    let angle = Math.atan2(lp.y, lp.x) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const frac = angle / (2 * Math.PI);
    setPs(p => {
      if (p.mode === 'hour') {
        const isInner = r < (RING_OUTER + RING_INNER) / 2;
        let h = Math.round(frac * 12) % 12;
        if (isInner) h = h === 0 ? 12 : h + 12;
        const d = new Date(p.date); d.setHours(wrap(h, 24));
        return { ...p, date: d, mode: 'minute' };
      } else {
        const m = Math.round(frac * 60) % 60;
        const d = new Date(p.date); d.setMinutes(wrap(m, 60));
        return { ...p, date: d };
      }
    });
    focusClockAfterPointer();
  }

  function handleNumPointerDown(ev: React.PointerEvent, onClick: () => void) {
    ev.preventDefault();
    ev.stopPropagation();
    suppressBlur.current = true;
    commitActiveField();
    onClick();
    focusClockAfterPointer();
  }

  // ---- input helpers ----

  function mkHandlers(
    ref: React.RefObject<HTMLInputElement | null>,
    maxLen: number,
    onFocusPart: () => void,
    commit: (v: string) => void,
    bump: (d: number) => void,
  ) {
    return {
      onFocus() {
        onFocusPart();
        requestAnimationFrame(() => { ref.current?.select(); });
      },
      onClick() { ref.current?.select(); },
      onMouseUp(ev: React.MouseEvent) { ev.preventDefault(); },
      onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        const el = ev.currentTarget;
        const filtered = onlyDigits(el.value).slice(0, maxLen);
        el.value = filtered;
        if (filtered.length >= maxLen) {
          commit(filtered);
          requestAnimationFrame(() => { el.focus(); el.select(); });
        }
      },
      onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
        if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          bump(ev.key === 'ArrowUp' ? 1 : -1);
          requestAnimationFrame(() => { ref.current?.focus(); ref.current?.select(); });
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          commit(ev.currentTarget.value);
          requestAnimationFrame(() => { ref.current?.focus(); ref.current?.select(); });
        }
      },
      onBlur() {
        if (suppressBlur.current) return;
        commit(ref.current!.value);
      },
    };
  }

  // ---- clock rendering ----

  function pointAt(idx12: number, r: number) {
    const a = (idx12 / 12) * 2 * Math.PI - Math.PI / 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  function renderClockNumbers() {
    const isHour = ps.mode === 'hour';
    const selected = isHour ? ps.date.getHours() : ps.date.getMinutes();
    const items: React.ReactNode[] = [];
    if (isHour) {
      for (let h = 0; h < 24; h++) {
        const p = pointAt(h % 12, h < 12 ? RING_OUTER : RING_INNER);
        const sel = h === selected, inner = h >= 12;
        items.push(
          <circle key={`h${h}`} cx={p.x} cy={p.y} r={22} className="dtp-clock-hit"
            onPointerDown={(ev) => handleNumPointerDown(ev, () => setHour(h))} />,
          <text key={`ht${h}`} x={p.x} y={p.y}
            className={`dtp-clock-num${inner ? ' dtp-inner' : ''}${sel ? ' dtp-sel' : ''}`}
            onPointerDown={(ev) => handleNumPointerDown(ev, () => setHour(h))}>
            {h}
          </text>,
        );
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const m = i * 5, p = pointAt(i, RING_OUTER), sel = m === selected;
        items.push(
          <circle key={`m${i}`} cx={p.x} cy={p.y} r={22} className="dtp-clock-hit"
            onPointerDown={(ev) => handleNumPointerDown(ev, () => setMinute(m))} />,
          <text key={`mt${i}`} x={p.x} y={p.y}
            className={`dtp-clock-num${sel ? ' dtp-sel' : ''}`}
            onPointerDown={(ev) => handleNumPointerDown(ev, () => setMinute(m))}>
            {pad2(m)}
          </text>,
        );
      }
    }
    return items;
  }

  function clockHand() {
    const h = ps.date.getHours(), m = ps.date.getMinutes();
    let idx12: number, r: number;
    if (ps.mode === 'hour') {
      idx12 = h % 12;
      r = (h >= 12 && h !== 0) ? RING_INNER : RING_OUTER;
      if (h === 12) { idx12 = 0; r = RING_INNER; }
    } else {
      idx12 = m / 5; r = RING_OUTER;
    }
    const p = pointAt(idx12, r);
    return { x: p.x, y: p.y, thumbR: r === RING_INNER ? 14 : 15 };
  }

  // ---- calendar rendering ----

  function calCells() {
    const cells: React.ReactNode[] = [];
    for (const d of DOW) {
      cells.push(<div key={`dow-${d}`} className="dtp-cal-cell dtp-dow">{d}</div>);
    }
    const first = new Date(ps.calY, ps.calM, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysThis = daysInMonth(ps.calY, ps.calM);
    const prevDays = daysInMonth(ps.calY, ps.calM - 1);
    for (let i = offset - 1; i >= 0; i--) {
      cells.push(calCell(prevDays - i, true, new Date(ps.calY, ps.calM - 1, prevDays - i)));
    }
    for (let d = 1; d <= daysThis; d++) {
      cells.push(calCell(d, false, new Date(ps.calY, ps.calM, d)));
    }
    const trailing = 42 - (offset + daysThis);
    for (let d = 1; d <= trailing; d++) {
      cells.push(calCell(d, true, new Date(ps.calY, ps.calM + 1, d)));
    }
    return cells;
  }

  function calCell(label: number, other: boolean, date: Date) {
    const isToday = date.getTime() === today.getTime();
    const isSel =
      date.getFullYear() === ps.date.getFullYear() &&
      date.getMonth() === ps.date.getMonth() &&
      date.getDate() === ps.date.getDate();
    let cls = 'dtp-cal-cell';
    if (other) cls += ' dtp-other';
    if (isToday) cls += ' dtp-today';
    if (isSel) cls += ' dtp-sel';
    return (
      <button key={date.toDateString()} type="button" className={cls}
        onClick={() => {
          const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ps.date.getHours(), ps.date.getMinutes());
          setPs(p => ({ ...p, date: d, mode: 'hour', calY: date.getFullYear(), calM: date.getMonth() }));
        }}>
        {label}
      </button>
    );
  }

  const hand = clockHand();

  return (
    <div className="dtp-panel">
      <div className="dtp-grid">

        {/* Calendar */}
        <div>
          <div className="dtp-cal-header">
            <button type="button" onClick={() => setPs(p => {
              const m = p.calM === 0 ? 11 : p.calM - 1;
              const y = p.calM === 0 ? p.calY - 1 : p.calY;
              return { ...p, calM: m, calY: y };
            })}>◀</button>
            <strong>{MONTHS[ps.calM]} {ps.calY}</strong>
            <button type="button" onClick={() => setPs(p => {
              const m = p.calM === 11 ? 0 : p.calM + 1;
              const y = p.calM === 11 ? p.calY + 1 : p.calY;
              return { ...p, calM: m, calY: y };
            })}>▶</button>
          </div>
          <div className="dtp-cal-grid">{calCells()}</div>
        </div>

        {/* Analog clock */}
        <div className="dtp-clock-panel">
          <svg ref={svgRef} className="dtp-clock-svg" viewBox="-110 -110 220 220"
            tabIndex={0} onPointerDown={handleSvgPointerDown}>
            <circle cx="0" cy="0" r="104" className="dtp-clock-bg" />
            <line x1="0" y1="0" x2={hand.x} y2={hand.y} className="dtp-clock-hand" />
            <circle cx={hand.x} cy={hand.y} r={hand.thumbR} className="dtp-clock-thumb" />
            <circle cx="0" cy="0" r="2.5" className="dtp-clock-center" />
            <g>{renderClockNumbers()}</g>
          </svg>
        </div>

        {/* Bottom row: date + time digital inputs */}
        <div className="dtp-bottom">

          <div className="dtp-date-block">
            <div className="dtp-date-display">
              <button type="button" className="dtp-stepper" onClick={() => bumpDay(1)}>▲</button>
              <button type="button" className="dtp-stepper" onClick={() => bumpMonth(1)}>▲</button>
              <button type="button" className="dtp-stepper" onClick={() => bumpYear(1)}>▲</button>

              <label className={`dtp-num-box${ps.part === 'day' ? ' dtp-active' : ''}`}>
                <span className="dtp-num-pair">
                  <input ref={ddRef}
                    className="dtp-num-input"
                    aria-label="Tag" inputMode="numeric" maxLength={2} autoComplete="off"
                    defaultValue={pad2(ps.date.getDate())}
                    {...mkHandlers(ddRef, 2, () => setPs(p => ({ ...p, part: 'day' })), (v) => setDatePartFromInput('day', v), bumpDay)}
                  />
                  <span className="dtp-num-suffix">.</span>
                </span>
              </label>
              <label className={`dtp-num-box${ps.part === 'month' ? ' dtp-active' : ''}`}>
                <span className="dtp-num-pair">
                  <input ref={mmRef}
                    className="dtp-num-input"
                    aria-label="Monat" inputMode="numeric" maxLength={2} autoComplete="off"
                    defaultValue={pad2(ps.date.getMonth() + 1)}
                    {...mkHandlers(mmRef, 2, () => setPs(p => ({ ...p, part: 'month' })), (v) => setDatePartFromInput('month', v), bumpMonth)}
                  />
                  <span className="dtp-num-suffix">.</span>
                </span>
              </label>
              <label className={`dtp-num-box dtp-num-box-y${ps.part === 'year' ? ' dtp-active' : ''}`}>
                <input ref={yyyyRef}
                  className="dtp-num-input dtp-num-input-y"
                  aria-label="Jahr" inputMode="numeric" maxLength={4} autoComplete="off"
                  defaultValue={ps.date.getFullYear().toString().padStart(4, '0')}
                  {...mkHandlers(yyyyRef, 4, () => setPs(p => ({ ...p, part: 'year' })), (v) => setDatePartFromInput('year', v), bumpYear)}
                />
              </label>

              <button type="button" className="dtp-stepper" onClick={() => bumpDay(-1)}>▼</button>
              <button type="button" className="dtp-stepper" onClick={() => bumpMonth(-1)}>▼</button>
              <button type="button" className="dtp-stepper" onClick={() => bumpYear(-1)}>▼</button>
            </div>
            <button type="button" className="dtp-preset" onClick={() => setPs(p => {
              const d = new Date(p.date);
              d.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
              return { ...p, date: d, part: 'day', calY: now.getFullYear(), calM: now.getMonth() };
            })}>Heute</button>
          </div>

          <div className="dtp-time-block">
            <div className="dtp-time-display">
              <button type="button" className="dtp-stepper" onClick={() => bumpHour(1)}>▲</button>
              <span className="dtp-spacer" />
              <button type="button" className="dtp-stepper" onClick={() => bumpMinute(1)}>▲</button>

              <input ref={hhRef}
                className={`dtp-num${ps.mode === 'hour' ? ' dtp-active' : ''}`}
                aria-label="Stunde" inputMode="numeric" maxLength={2} autoComplete="off"
                defaultValue={pad2(ps.date.getHours())}
                {...mkHandlers(hhRef, 2, () => setPs(p => ({ ...p, mode: 'hour' })), (v) => setTimePartFromInput('hour', v), bumpHour)}
              />
              <span className="dtp-colon">:</span>
              <input ref={minRef}
                className={`dtp-num${ps.mode === 'minute' ? ' dtp-active' : ''}`}
                aria-label="Minute" inputMode="numeric" maxLength={2} autoComplete="off"
                defaultValue={pad2(ps.date.getMinutes())}
                {...mkHandlers(minRef, 2, () => setPs(p => ({ ...p, mode: 'minute' })), (v) => setTimePartFromInput('minute', v), bumpMinute)}
              />

              <button type="button" className="dtp-stepper" onClick={() => bumpHour(-1)}>▼</button>
              <span className="dtp-spacer" />
              <button type="button" className="dtp-stepper" onClick={() => bumpMinute(-1)}>▼</button>
            </div>
            <button type="button" className="dtp-preset" onClick={() => setPs(p => {
              const d = new Date(p.date);
              d.setHours(now.getHours(), now.getMinutes());
              return { ...p, date: d, mode: 'hour' };
            })}>Jetzt</button>
          </div>

        </div>
      </div>

      <div className="dtp-footer">
        <button type="button" className="dtp-btn" onClick={onCancel}>Abbrechen</button>
        <button type="button" className="dtp-btn dtp-primary" onClick={() => onConfirm(ps.date)}>OK</button>
      </div>
    </div>
  );
}

// ---- public component ----

export interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange(value: string): void;
  /** When true, the trigger is rendered but doesn't open the popup. Used to
   *  show a derived/inherited timestamp (e.g., the Startzeitpunkt of a
   *  non-initial phase, fixed by the predecessor's Stoppzeitpunkt). */
  disabled?: boolean;
}

export function DateTimePicker({ id, value, onChange, disabled }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parseInputStr(value) : null;

  function handleConfirm(d: Date) {
    onChange(toInputStr(d));
    setOpen(false);
  }

  return (
    <>
      <button
        id={id}
        type="button"
        className="dtp-trigger"
        onClick={() => { if (!disabled) setOpen(true); }}
        disabled={disabled}
        title={disabled ? 'Aus Vorgängerphase übernommen' : undefined}
      >
        {parsed
          ? fmtDisplay(parsed)
          : <span className="dtp-placeholder">Datum &amp; Zeit wählen</span>}
      </button>
      {open && (
        <div className="dtp-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="dtp-popup">
            <PickerPanel
              initial={parsed ?? new Date()}
              onConfirm={handleConfirm}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
