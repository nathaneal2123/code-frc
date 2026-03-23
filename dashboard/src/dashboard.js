import { NT4 } from './nt4.js';

// ── Connect to local proxy server ────────────────────────────────────────────
const nt = new NT4(`ws://${location.hostname}:${location.port}/nt`);

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function fmtTime(secs) {
  if (secs < 0) return '-:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Connection status ─────────────────────────────────────────────────────────
nt.onConnect(() => {
  $('b-conn').textContent  = 'NT: OK';
  $('b-conn').className    = 'badge badge-ok';
});
nt.onDisconnect(() => {
  $('b-conn').textContent  = 'NT: --';
  $('b-conn').className    = 'badge badge-off';
});

// ── Match Timer ───────────────────────────────────────────────────────────────
nt.on('/SmartDashboard/Match Time', v => {
  const t = typeof v === 'number' ? v : -1;
  $('timer').textContent = fmtTime(t);
  $('timer').className   =
    t < 0  ? 'timer'            :
    t < 10 ? 'timer timer-red'  :
    t < 30 ? 'timer timer-amber':
             'timer';
});

// ── Robot Status ──────────────────────────────────────────────────────────────
nt.on('/SmartDashboard/IsEnabled', v => {
  const en = Boolean(v);
  $('b-enabled').textContent = en ? 'ENABLED' : 'DISABLED';
  $('b-enabled').className   = `badge ${en ? 'badge-ok' : 'badge-err'}`;
});

nt.on('/SmartDashboard/IsAutonomous', v => {
  const auto = Boolean(v);
  $('b-mode').textContent = auto ? 'AUTO' : 'TELEOP';
  $('b-mode').className   = `badge ${auto ? 'badge-warn' : 'badge-info'}`;
});

// ── Auto Chooser ──────────────────────────────────────────────────────────────
const autoSelect = $('auto-select');
let _autoOptions = [];
let _autoActive  = '';
let _userChanging = false;

function rebuildChooser() {
  const current = autoSelect.value;
  autoSelect.innerHTML = '';
  _autoOptions.forEach(opt => {
    const el = document.createElement('option');
    el.value = el.textContent = opt;
    if (opt === _autoActive) el.selected = true;
    autoSelect.appendChild(el);
  });
  // Restore selection if active isn't in options yet
  if (!_autoActive && current) autoSelect.value = current;
  $('auto-active').textContent = _autoActive || '—';
}

nt.on('/SmartDashboard/Auto Chooser/options', v => {
  if (!Array.isArray(v)) return;
  _autoOptions = v.map(String);
  rebuildChooser();
});

nt.on('/SmartDashboard/Auto Chooser/active', v => {
  if (_userChanging) return;
  _autoActive = String(v ?? '');
  autoSelect.value = _autoActive;
  $('auto-active').textContent = _autoActive || '—';
});

autoSelect.addEventListener('change', () => {
  _userChanging = true;
  _autoActive   = autoSelect.value;
  $('auto-active').textContent = _autoActive;
  nt.publish('/SmartDashboard/Auto Chooser/active', 'string', _autoActive);
  setTimeout(() => { _userChanging = false; }, 200);
});

// ── Shooter RPM ───────────────────────────────────────────────────────────────
const MAX_RPM = 6000;

function updateRPM(fillId, valId, rpm) {
  const v   = typeof rpm === 'number' ? rpm : 0;
  const abs = Math.abs(v);
  const pct = clamp(abs / MAX_RPM * 100, 0, 100);

  const fill = $(fillId);
  fill.style.width      = pct + '%';
  fill.style.background =
    pct > 75 ? 'var(--green)'  :
    pct > 35 ? 'var(--cyan)'   :
               '#2a4a5a';

  $(valId).textContent = v.toFixed(0);
}

nt.on('/SmartDashboard/Shooter Left RPM',  v => updateRPM('rpm-left-fill',  'rpm-left-val',  v));
nt.on('/SmartDashboard/Shooter Right RPM', v => updateRPM('rpm-right-fill', 'rpm-right-val', v));

// ── Intake Arm Diagram ────────────────────────────────────────────────────────
// Pivot at SVG coords (100, 110). Arm sweeps from 0° (stowed, pointing up)
// to 150° (deployed, pointing down-right). Angle measured from vertical.
const PIV_X   = 100;
const PIV_Y   = 110;
const ARM_LEN = 85;
const ARC_R   = ARM_LEN + 14;

function armPoint(angleDeg, r = ARM_LEN) {
  const rad = angleDeg * Math.PI / 180;
  return {
    x: PIV_X + r * Math.sin(rad),
    y: PIV_Y - r * Math.cos(rad),
  };
}

function svgArc(cx, cy, r, a0, a1) {
  if (Math.abs(a1 - a0) < 0.1) return '';
  const s    = armPoint(a0, r); // use armPoint for angle from vertical
  const e    = armPoint(a1, r);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// Static range arc (0° → 150°)
$('arm-range').setAttribute('d', svgArc(PIV_X, PIV_Y, ARC_R, 0, 150));

function updateArm(angleDeg) {
  const a  = typeof angleDeg === 'number' ? clamp(angleDeg, 0, 155) : 0;
  const ep = armPoint(a);

  const line = $('arm-line');
  line.setAttribute('x1', PIV_X); line.setAttribute('y1', PIV_Y);
  line.setAttribute('x2', ep.x.toFixed(2)); line.setAttribute('y2', ep.y.toFixed(2));

  $('arm-roller').setAttribute('cx', ep.x.toFixed(2));
  $('arm-roller').setAttribute('cy', ep.y.toFixed(2));

  $('arm-angle-text').textContent = a.toFixed(1) + '°';

  // Arc fill from 0 to current angle
  $('arm-fill').setAttribute('d', a > 1 ? svgArc(PIV_X, PIV_Y, ARC_R, 0, a) : '');

  // Color: green when deployed (>100°), amber mid, cyan when near stow
  const color =
    a > 100 ? 'var(--green)'  :
    a > 30  ? 'var(--amber)'  :
              'var(--cyan)';
  $('arm-line').style.stroke   = color;
  $('arm-roller').style.stroke = color;
}

nt.on('/SmartDashboard/Intake Pivot Angle', updateArm);
updateArm(0); // initial draw

// ── Duty Cycle Bars ───────────────────────────────────────────────────────────
function updateDuty(fillId, valId, v) {
  const duty = typeof v === 'number' ? clamp(v, -1, 1) : 0;
  const fill = $(fillId);
  const pct  = Math.abs(duty) * 50; // 50% = max half-bar width

  if (duty >= 0) {
    fill.style.left       = '50%';
    fill.style.width      = pct + '%';
    fill.style.background = duty > 0.05 ? 'var(--green)' : 'transparent';
  } else {
    fill.style.left       = (50 - pct) + '%';
    fill.style.width      = pct + '%';
    fill.style.background = duty < -0.05 ? 'var(--amber)' : 'transparent';
  }

  const el = $(valId);
  el.textContent = duty.toFixed(2);
  el.style.color =
    duty > 0.05  ? 'var(--green)'  :
    duty < -0.05 ? 'var(--amber)'  :
                   'var(--muted)';
}

nt.on('/SmartDashboard/Feeder DutyCycle',        v => updateDuty('duty-feeder', 'val-feeder', v));
nt.on('/SmartDashboard/Hopper DutyCycle',        v => updateDuty('duty-hopper', 'val-hopper', v));
nt.on('/SmartDashboard/Intake Roller DutyCycle', v => updateDuty('duty-roller', 'val-roller', v));
