const KEY = 'openbook-v1',
  $ = (s) => document.querySelector(s),
  pad = (n) => String(n).padStart(2, '0');
const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (d, t) => new Date(d + 'T' + t).getTime();
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const f12 = (t) => {
  const h = +t.slice(0, 2);
  return ((h + 11) % 12) + 1 + ':' + t.slice(3, 5) + (h < 12 ? ' AM' : ' PM');
};
const fDay = (k) =>
  new Date(k + 'T00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
const fDT = (ms) =>
  new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
const REM = [
  ['1440', '1 day before'],
  ['60', '1 hour before'],
  ['15', '15 minutes before'],
  ['none', 'No reminder'],
];
const CH = [
  ['email', 'Email'],
  ['push', 'Browser push'],
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function seed() {
  const d = (n) => {
    const x = new Date();
    x.setDate(x.getDate() + n);
    return ds(x);
  };
  const e1 = uid();
  return {
    offset: 0,
    events: [
      {
        id: e1,
        title: "Chef's table dinner",
        date: d(2),
        time: '19:00',
        cap: 2,
        loc: 'Back room',
      },
      {
        id: uid(),
        title: 'Pricing your services workshop',
        date: d(5),
        time: '10:00',
        cap: 12,
        loc: 'Studio A',
      },
      {
        id: uid(),
        title: 'Community meetup',
        date: d(9),
        time: '17:30',
        cap: 20,
        loc: 'Main hall',
      },
    ],
    rsvps: [
      {
        id: uid(),
        eventId: e1,
        name: 'Maya Reyes',
        email: 'maya@example.com',
        status: 'going',
        rem: '60',
        ch: 'email',
      },
      {
        id: uid(),
        eventId: e1,
        name: 'Jon Park',
        email: 'jon@example.com',
        status: 'going',
        rem: 'none',
        ch: 'email',
      },
    ],
    avail: { days: [1, 2, 3, 4, 5], start: 9, end: 17, len: 30 },
    bookings: [
      {
        id: uid(),
        date: d(1),
        time: '10:00',
        name: 'Ana Cruz',
        email: 'ana@example.com',
      },
    ],
    outbox: [],
  };
}
let S;
try {
  S = JSON.parse(localStorage.getItem(KEY));
} catch (e) {}
if (!S || !S.events) S = seed();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {}
};
const now = () => Date.now() + S.offset;
let tab = 'book',
  view = { y: new Date().getFullYear(), m: new Date().getMonth() },
  sel = ds(new Date());
const ev = (id) => S.events.find((e) => e.id === id);
const going = (id) =>
  S.rsvps.filter((r) => r.eventId === id && r.status === 'going').length;

function slots(k) {
  const a = S.avail,
    out = [];
  if (!a.days.includes(new Date(k + 'T00:00').getDay())) return out;
  for (let m = a.start * 60; m + a.len <= a.end * 60; m += a.len) {
    const t = pad((m / 60) | 0) + ':' + pad(m % 60);
    if (at(k, t) <= now()) continue;
    out.push({ t, taken: S.bookings.some((b) => b.date === k && b.time === t) });
  }
  return out;
}
function sched(o, title, when, ref) {
  if (o.rem === 'none') return;
  S.outbox.push({
    id: uid(),
    ref,
    to: o.ch === 'push' ? 'this browser' : o.email,
    ch: o.ch,
    title,
    when,
    sendAt: when - o.rem * 60000,
    status: 'scheduled',
  });
  if (o.ch === 'push')
    try {
      Notification.requestPermission();
    } catch (e) {}
}
function promote(id) {
  const e = ev(id);
  if (!e) return;
  while (going(id) < e.cap) {
    const w = S.rsvps.find((r) => r.eventId === id && r.status === 'wait');
    if (!w) break;
    w.status = 'going';
    sched(w, e.title, at(e.date, e.time), w.id);
  }
}
function tick() {
  let n = 0;
  S.outbox.forEach((o) => {
    if (o.status === 'scheduled' && o.sendAt <= now()) {
      o.status = 'sent';
      o.sentAt = now();
      n++;
      if (o.ch === 'push')
        try {
          if (Notification.permission === 'granted')
            new Notification('Reminder: ' + o.title, { body: fDT(o.when) });
        } catch (e) {}
    }
  });
  if (n) {
    toast(n + (n > 1 ? ' reminders' : ' reminder') + ' sent');
    render();
  }
}
let tt;
function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('s');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('s'), 2600);
}

function modal(title, sub, fields, label, cb) {
  const m = $('#modal');
  m.innerHTML =
    `<div class="mb" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p class="mu">${esc(sub || '')}</p>` +
    fields
      .map(
        (f) =>
          `<label>${f.l}${f.o ? `<select id="f_${f.k}">${f.o.map((o) => `<option value="${o[0]}"${o[0] == f.v ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>` : `<input id="f_${f.k}" type="${f.t || 'text'}" value="${esc(f.v ?? '')}"${f.t === 'number' ? ' min="1"' : ''}>`}</label>`,
      )
      .join('') +
    `<div class="ra"><button class="b2" id="mx">Cancel</button><button class="b1" id="mo">${label}</button></div></div>`;
  m.hidden = false;
  const first = m.querySelector('input,select');
  if (first) first.focus();
  const close = () => {
    m.hidden = true;
    m.innerHTML = '';
  };
  $('#mx').onclick = close;
  m.onclick = (e) => {
    if (e.target === m) close();
  };
  $('#mo').onclick = () => {
    const v = {};
    for (const f of fields) {
      v[f.k] = $('#f_' + f.k).value.trim();
      if (f.req && !v[f.k]) return toast('Fill in ' + f.l.toLowerCase() + ' to continue');
      if (f.k === 'email' && !/^\S+@\S+\.\S+$/.test(v.email))
        return toast('Enter a valid email address');
    }
    close();
    cb(v);
    render();
  };
}

const A = {
  tab: (d) => {
    tab = d.t;
    render();
  },
  nav: (d) => {
    view.m += +d.n;
    if (view.m < 0) {
      view.m = 11;
      view.y--;
    }
    if (view.m > 11) {
      view.m = 0;
      view.y++;
    }
    render();
  },
  day: (d) => {
    sel = d.d;
    render();
  },
  rsvp: (d) => {
    const e = ev(d.id),
      full = going(e.id) >= e.cap;
    modal(
      'RSVP: ' + e.title,
      full
        ? 'This event is full. Choose Going to join the waitlist.'
        : fDay(e.date) + ' at ' + f12(e.time),
      [
        { k: 'name', l: 'Your name', req: 1 },
        { k: 'email', l: 'Email', t: 'email', req: 1 },
        {
          k: 'st',
          l: 'Response',
          o: [
            ['going', 'Going'],
            ['maybe', 'Maybe'],
            ['no', "Can't make it"],
          ],
        },
        { k: 'rem', l: 'Reminder', o: REM, v: '60' },
        { k: 'ch', l: 'Send reminder by', o: CH },
      ],
      'Send RSVP',
      (v) => {
        let st = v.st;
        if (st === 'going' && going(e.id) >= e.cap) st = 'wait';
        const r = {
          id: uid(),
          eventId: e.id,
          name: v.name,
          email: v.email,
          status: st,
          rem: v.rem,
          ch: v.ch,
        };
        S.rsvps.push(r);
        if (st === 'going') sched(r, e.title, at(e.date, e.time), r.id);
        toast(st === 'wait' ? 'You are on the waitlist' : 'RSVP saved');
        tick();
      },
    );
  },
  book: (d) => {
    modal(
      'Book ' + f12(d.t),
      fDay(d.d) + ' · ' + S.avail.len + ' min consultation',
      [
        { k: 'name', l: 'Your name', req: 1 },
        { k: 'email', l: 'Email', t: 'email', req: 1 },
        { k: 'rem', l: 'Reminder', o: REM, v: '60' },
        { k: 'ch', l: 'Send reminder by', o: CH },
      ],
      'Confirm booking',
      (v) => {
        if (S.bookings.some((b) => b.date === d.d && b.time === d.t))
          return toast('That slot was just taken. Pick another.');
        const b = { id: uid(), date: d.d, time: d.t, name: v.name, email: v.email };
        S.bookings.push(b);
        sched(v, 'Consultation with Openbook', at(d.d, d.t), b.id);
        toast('Booked for ' + f12(d.t));
        tick();
      },
    );
  },
  evNew: () => evForm(),
  evEdit: (d) => evForm(ev(d.id)),
  evDel: (d) => {
    if (!confirm('Delete this event and its RSVPs?')) return;
    const ids = S.rsvps.filter((r) => r.eventId === d.id).map((r) => r.id);
    S.rsvps = S.rsvps.filter((r) => r.eventId !== d.id);
    S.outbox = S.outbox.filter((o) => !ids.includes(o.ref));
    S.events = S.events.filter((e) => e.id !== d.id);
    toast('Event deleted');
    render();
  },
  rsDel: (d) => {
    const r = S.rsvps.find((x) => x.id === d.id);
    S.rsvps = S.rsvps.filter((x) => x.id !== d.id);
    S.outbox = S.outbox.filter((o) => o.ref !== d.id);
    if (r) promote(r.eventId);
    toast('RSVP removed');
    render();
  },
  bkDel: (d) => {
    S.bookings = S.bookings.filter((b) => b.id !== d.id);
    S.outbox = S.outbox.filter((o) => o.ref !== d.id);
    toast('Booking cancelled, slot reopened');
    render();
  },
  wd: (d) => {
    const i = +d.i,
      a = S.avail.days;
    S.avail.days = a.includes(i) ? a.filter((x) => x !== i) : [...a, i];
    render();
  },
  clock: (d) => {
    S.offset += +d.h * 3600000;
    tick();
    render();
  },
  clockReset: () => {
    S.offset = 0;
    render();
  },
  reset: () => {
    if (confirm('Reset all demo data?')) {
      S = seed();
      render();
    }
  },
};
function evForm(e) {
  modal(
    e ? 'Edit event' : 'New event',
    '',
    [
      { k: 'title', l: 'Title', v: e?.title, req: 1 },
      { k: 'date', l: 'Date', t: 'date', v: e?.date || sel, req: 1 },
      { k: 'time', l: 'Start time', t: 'time', v: e?.time || '18:00', req: 1 },
      { k: 'cap', l: 'Capacity', t: 'number', v: e?.cap || 10, req: 1 },
      { k: 'loc', l: 'Location', v: e?.loc },
    ],
    e ? 'Save changes' : 'Create event',
    (v) => {
      const o = {
        title: v.title,
        date: v.date,
        time: v.time,
        cap: Math.max(1, +v.cap || 1),
        loc: v.loc,
      };
      if (e) {
        Object.assign(e, o);
        S.rsvps
          .filter((r) => r.eventId === e.id)
          .forEach((r) => {
            const q = S.outbox.find((x) => x.ref === r.id && x.status === 'scheduled');
            if (q) {
              q.when = at(e.date, e.time);
              q.title = e.title;
              q.sendAt = q.when - r.rem * 60000;
            }
          });
        promote(e.id);
        toast('Event updated');
      } else {
        S.events.push({ id: uid(), ...o });
        toast('Event created');
      }
    },
  );
}
const C = {
  av: (t) => {
    S.avail[t.dataset.k] = +t.value;
    render();
  },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-a]');
  if (t) A[t.dataset.a](t.dataset);
});
document.addEventListener('change', (e) => {
  const t = e.target.closest('[data-c]');
  if (t) C[t.dataset.c](t);
});

function pageBook() {
  const first = new Date(view.y, view.m, 1),
    dim = new Date(view.y, view.m + 1, 0).getDate(),
    tk = ds(new Date(now()));
  let cells =
    DAYS.map((d) => `<span>${d[0]}</span>`).join('') + '<i></i>'.repeat(first.getDay());
  for (let d = 1; d <= dim; d++) {
    const k = ds(new Date(view.y, view.m, d)),
      hasE = S.events.some((e) => e.date === k),
      hasA = k >= tk && slots(k).some((s) => !s.taken);
    cells += `<button data-a="day" data-d="${k}" class="${k < tk ? 'past ' : ''}${k === tk ? 'today ' : ''}${k === sel ? 'sel' : ''}" aria-label="${fDay(k)}">${d}<span class="d">${hasE ? '<u></u>' : ''}${hasA ? '<u class="a"></u>' : ''}</span></button>`;
  }
  const evs = S.events
    .filter((e) => e.date === sel)
    .sort((a, b) => a.time.localeCompare(b.time));
  const sl = sel >= ds(new Date(now())) ? slots(sel) : [];
  const month = new Date(view.y, view.m, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  return `<div class="grid"><div class="card">
    <div class="cal-h"><button data-a="nav" data-n="-1" aria-label="Previous month">‹</button><h2>${month}</h2><button data-a="nav" data-n="1" aria-label="Next month">›</button></div>
    <div class="cg">${cells}</div>
    <div class="lg"><span><u></u>Event</span><span><u class="a"></u>Open for booking</span></div></div>
  <div><div class="card"><h2>${fDay(sel)}</h2>
    ${
      evs.length
        ? evs
            .map((e) => {
              const g = going(e.id),
                full = g >= e.cap,
                w = S.rsvps.filter(
                  (r) => r.eventId === e.id && r.status === 'wait',
                ).length;
              return `<div class="item"><div class="r"><div><b>${esc(e.title)}</b><span class="mu">${f12(e.time)}${e.loc ? ' · ' + esc(e.loc) : ''}</span><br>
      <span class="pill ${full ? 'wa' : 'ok'}">${full ? 'Full' : e.cap - g + ' spots left'}</span>${w ? ` <span class="pill wa">${w} waitlisted</span>` : ''}</div>
      <button class="b1" data-a="rsvp" data-id="${e.id}">${full ? 'Join waitlist' : 'RSVP'}</button></div></div>`;
            })
            .join('')
        : '<p class="empty">No events on this day.</p>'
    }
  </div>
  <div class="card"><h2>Book a ${S.avail.len}-minute consultation</h2>
    ${sl.length ? `<p class="mu">Pick a time. Taken slots are crossed out.</p><div class="slots">${sl.map((s) => `<button ${s.taken ? 'disabled' : `data-a="book" data-d="${sel}" data-t="${s.t}"`}>${f12(s.t)}</button>`).join('')}</div>` : '<p class="empty">No bookable times on this day. Days with a green ring are open.</p>'}
  </div></div></div>`;
}

function pageAdmin() {
  const nowMs = now(),
    ups = S.events.filter((e) => at(e.date, e.time) >= nowMs);
  const evs = [...S.events].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  );
  const rs = S.rsvps.filter((r) => ev(r.eventId));
  const bk = [...S.bookings].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  );
  const ob = [...S.outbox].sort((a, b) => a.sendAt - b.sendAt);
  const hrs = (n) => Array.from({ length: 24 }, (_, i) => [i, f12(pad(i) + ':00')]);
  const sel2 = (k, list) =>
    `<select data-c="av" data-k="${k}" aria-label="${k}">${list.map((o) => `<option value="${o[0]}"${o[0] == S.avail[k] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  return `<div class="stats">
    <div class="stat"><strong>${ups.length}</strong><span class="mu">Upcoming events</span></div>
    <div class="stat"><strong>${rs.filter((r) => r.status === 'going').length}</strong><span class="mu">Confirmed guests</span></div>
    <div class="stat"><strong>${bk.filter((b) => at(b.date, b.time) >= nowMs).length}</strong><span class="mu">Upcoming bookings</span></div>
    <div class="stat"><strong>${S.outbox.filter((o) => o.status === 'scheduled').length}</strong><span class="mu">Reminders queued</span></div></div>
  <div class="card"><div class="ph"><h2>Events</h2><button class="b1" data-a="evNew">New event</button></div>
    <div class="tw"><table><tr><th>Event</th><th>When</th><th>Going</th><th>Waitlist</th><th></th></tr>
    ${
      evs
        .map(
          (
            e,
          ) => `<tr><td>${esc(e.title)}</td><td>${e.date} ${f12(e.time)}</td><td>${going(e.id)}/${e.cap}</td><td>${S.rsvps.filter((r) => r.eventId === e.id && r.status === 'wait').length}</td>
    <td><button class="b2" data-a="evEdit" data-id="${e.id}">Edit</button> <button class="b3" data-a="evDel" data-id="${e.id}">Delete</button></td></tr>`,
        )
        .join('') ||
      '<tr><td colspan="5" class="empty">No events yet. Create one to start taking RSVPs.</td></tr>'
    }</table></div></div>
  <div class="card"><h2>RSVPs</h2><div class="tw"><table><tr><th>Guest</th><th>Event</th><th>Status</th><th></th></tr>
    ${
      rs
        .map(
          (
            r,
          ) => `<tr><td>${esc(r.name)}<br><span class="mu">${esc(r.email)}</span></td><td>${esc(ev(r.eventId).title)}</td>
    <td><span class="pill ${r.status === 'going' ? 'ok' : r.status === 'wait' ? 'wa' : ''}">${{ going: 'Going', maybe: 'Maybe', no: "Can't make it", wait: 'Waitlist' }[r.status]}</span></td>
    <td><button class="b3" data-a="rsDel" data-id="${r.id}">Remove</button></td></tr>`,
        )
        .join('') || '<tr><td colspan="4" class="empty">No RSVPs yet.</td></tr>'
    }</table></div>
    <p class="mu" style="margin-top:8px">Removing a confirmed guest moves the next waitlisted person in automatically.</p></div>
  <div class="card"><h2>Availability for consultations</h2>
    <div class="chips">${DAYS.map((d, i) => `<button data-a="wd" data-i="${i}" class="${S.avail.days.includes(i) ? 'on' : ''}" aria-pressed="${S.avail.days.includes(i)}">${d}</button>`).join('')}</div>
    <div class="row"><span class="mu">From</span>${sel2('start', hrs())}<span class="mu">to</span>${sel2('end', hrs())}
    <span class="mu">Slot length</span>${sel2('len', [
      [15, '15 min'],
      [30, '30 min'],
      [45, '45 min'],
      [60, '60 min'],
    ])}</div></div>
  <div class="card"><h2>Bookings</h2><div class="tw"><table><tr><th>When</th><th>Client</th><th></th></tr>
    ${bk.map((b) => `<tr><td>${b.date} ${f12(b.time)}</td><td>${esc(b.name)}<br><span class="mu">${esc(b.email)}</span></td><td><button class="b3" data-a="bkDel" data-id="${b.id}">Cancel</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">No bookings yet.</td></tr>'}</table></div></div>
  <div class="card"><div class="ph"><h2>Reminder outbox</h2></div>
    <p class="mu">Reminders send on a schedule. This demo keeps a clock you can move forward to watch them go out.</p>
    <div class="row"><b>Demo time: ${fDT(nowMs)}</b><button class="b2" data-a="clock" data-h="1">+1 hour</button><button class="b2" data-a="clock" data-h="24">+1 day</button><button class="b2" data-a="clockReset">Reset clock</button></div>
    <div class="tw" style="margin-top:8px"><table><tr><th>Send at</th><th>To</th><th>Via</th><th>About</th><th>Status</th></tr>
    ${ob.map((o) => `<tr><td>${fDT(o.sendAt)}</td><td>${esc(o.to)}</td><td>${o.ch === 'push' ? 'Push' : 'Email'}</td><td>${esc(o.title)}</td><td><span class="pill ${o.status === 'sent' ? 'ok' : ''}">${o.status === 'sent' ? 'Sent' : 'Queued'}</span></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nothing queued. RSVP or book with a reminder to see it here.</td></tr>'}</table></div></div>
  <p class="mu" style="text-align:center;margin-bottom:24px">Data lives in this browser only. <button data-a="reset" style="text-decoration:underline">Reset demo data</button></p>`;
}
function render() {
  $('#tabs').innerHTML = [
    ['book', 'Book'],
    ['admin', 'Admin'],
  ]
    .map(
      (t) =>
        `<button data-a="tab" data-t="${t[0]}" class="${tab === t[0] ? 'on' : ''}">${t[1]}</button>`,
    )
    .join('');
  $('#main').innerHTML = tab === 'book' ? pageBook() : pageAdmin();
  save();
}
render();
tick();
setInterval(tick, 5000);