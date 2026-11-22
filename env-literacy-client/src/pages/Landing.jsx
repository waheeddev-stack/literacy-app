import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../api/client.js';
import ChatWidget from '../components/ChatWidget.jsx';
import '../styles/landing.css';

const prefersReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Fade-in on scroll (IntersectionObserver), gentle parallax via data-speed, and a nav that gains a background after scrolling.
function useLandingMotion(rootRef, setScrolled) {
  useEffect(() => {
    const root = rootRef.current; if (!root) return undefined;
    const reduced = prefersReduced();
    const els = [...root.querySelectorAll('.reveal')];
    let io;
    if (reduced || !('IntersectionObserver' in window)) els.forEach(e => e.classList.add('in'));
    else {
      io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
      els.forEach(e => io.observe(e));
    }
    const layers = [...root.querySelectorAll('[data-speed]')];
    let raf = 0;
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      if (reduced || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        if (y < window.innerHeight * 1.5) layers.forEach(l => { l.style.transform = `translate3d(0, ${(y * Number(l.dataset.speed)).toFixed(1)}px, 0)`; });
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); io?.disconnect(); cancelAnimationFrame(raf); };
  }, [rootRef, setScrolled]);
}

const Leaf = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20C4 9 11 3 21 3c0 10-6 17-17 17Z" fill="currentColor" opacity=".95" /><path d="M5 19C9 14 13 11 17 8" stroke="#F6F2E9" strokeWidth="1.3" fill="none" strokeLinecap="round" /></svg>
);
const Divider = ({ tone = 'bg', flip }) => (
  <svg className={`ld-divider ${tone}`} viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true" style={flip ? { transform: 'scaleY(-1)' } : undefined}>
    <path d="M0 40C180 8 340 8 520 34s330 36 520 8 290-30 400-8V70H0Z" />
  </svg>
);

const ICONS = {
  quiz: <path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  habit: <path d="M4 13l5 5L20 6" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  gap: <path d="M4 18V9m5 9V5m5 13v-7m5 7V8" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" />,
  campus: <path d="M3 20V9l9-5 9 5v11M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round" />,
  map: <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round" />,
  spark: <path d="M12 3c1 4 3 6 7 7-4 1-6 3-7 7-1-4-3-6-7-7 4-1 6-3 7-7Z" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round" />,
};
const Icon = ({ name }) => <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>;

const FEATURES = [
  ['quiz', 'Knowledge quizzes', 'Baseline, periodic and teacher-assigned quizzes across eight topics, tuned to each grade band, with explanations after every answer.'],
  ['habit', 'Weekly practice check-ins', 'A calm, under-a-minute list of real habits: segregating waste, saving water, choosing greener travel. No leaderboards, ever.'],
  ['gap', 'Knowledge–practice gap', 'See where learners know more than they act, and where they act without knowing why, per student, class and institution.'],
  ['campus', 'Campus audit', 'Institutions score ten sustainability basics, from rainwater harvesting to composting, and combine it with student results.'],
  ['map', 'Regional heatmap', 'Municipal bodies and NGO partners compare institutions and spot topics that need attention across Mira-Bhayandar. Aggregates only.'],
  ['spark', 'Eco-challenges', 'Gentle seven-day habit challenges and personal badges that turn awareness into everyday action.'],
];

const TABS = [
  { id: 'students', label: 'Students', big: 'Know it. Do it.', small: 'Two numbers, one honest picture.', steps: [
    ['Take the baseline quiz', 'One question per screen, auto-scored, with a short explanation after each answer.'],
    ['Check in once a week', 'Toggle a few habits. It takes under a minute and works on a low-end phone.'],
    ['See your gap', 'Knowledge, practice and a friendly suggestion for what to try next.'],
  ] },
  { id: 'teachers', label: 'Teachers', big: 'Know your class.', small: 'Spot who needs support, fast.', steps: [
    ['Create a class', 'Share one class code. Students join on their own.'],
    ['Assign a quiz', 'Pick topics; questions are chosen from the bank for the grade band.'],
    ['Read the class gap', 'Weakest topics, participation, and a short list of students to nudge.'],
  ] },
  { id: 'institutions', label: 'Institutions', big: 'Prove progress.', small: 'Term by term, with evidence.', steps: [
    ['Complete the campus audit', 'Score ten items and attach photo evidence links.'],
    ['Track the trend', 'Watch student sustainability scores and the audit move together over terms.'],
    ['Export a report', 'One-click CSV or PDF, with aggregates only.'],
  ] },
  { id: 'region', label: 'Region', big: 'See the whole map.', small: 'Targeted action, not guesswork.', steps: [
    ['Compare institutions', 'A ranked view of schools and colleges, with privacy-safe aggregates.'],
    ['Find the weak topics', 'A topic heatmap shows where knowledge and habits diverge most.'],
    ['Shape the content', 'Review the question bank and its item statistics with educators.'],
  ] },
];

function Tabs() {
  const [active, setActive] = useState('students');
  const refs = useRef({});
  const t = TABS.find(x => x.id === active);
  const onKey = e => {
    const i = TABS.findIndex(x => x.id === active);
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : null;
    if (next != null) { e.preventDefault(); setActive(TABS[next].id); refs.current[TABS[next].id]?.focus(); }
  };
  return (<>
    <div className="ld-tablist" role="tablist" aria-label="How it works for each role" onKeyDown={onKey}>
      {TABS.map(x => <button key={x.id} ref={el => { refs.current[x.id] = el; }} role="tab" id={`tab-${x.id}`} aria-selected={active === x.id} aria-controls="tabpanel" tabIndex={active === x.id ? 0 : -1} onClick={() => setActive(x.id)}>{x.label}</button>)}
    </div>
    <div className="ld-panel" role="tabpanel" id="tabpanel" aria-labelledby={`tab-${active}`}>
      <ol className="ld-steps">{t.steps.map(([b, s]) => <li key={b}><b>{b}</b><span>{s}</span></li>)}</ol>
      <div className="ld-panel-art"><div><strong>{t.big}</strong><span>{t.small}</span></div></div>
    </div>
  </>);
}

function Newsletter() {
  const [email, setEmail] = useState(''); const [state, setState] = useState({ busy: false, msg: '', err: '' });
  const submit = async e => {
    e.preventDefault(); setState({ busy: true, msg: '', err: '' });
    try { const d = await post('/newsletter', { email }); setEmail(''); setState({ busy: false, msg: d.message, err: '' }); }
    catch (x) { setState({ busy: false, msg: '', err: x.message }); }
  };
  return (
    <form onSubmit={submit} aria-label="Newsletter signup">
      <div className="ld-news">
        <label className="sr-only" htmlFor="nl-email">Email address</label>
        <input id="nl-email" className="input" type="email" required placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn" disabled={state.busy}>{state.busy ? 'Joining…' : 'Subscribe'}</button>
      </div>
      {state.msg && <p className="ok" role="status">{state.msg}</p>}
      {state.err && <p className="err" role="alert">{state.err}</p>}
    </form>
  );
}

const Social = ({ label, children }) => <a href="#top" aria-label={label} title={label}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{children}</svg></a>;

export default function Landing() {
  const rootRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useLandingMotion(rootRef, setScrolled);
  const close = () => setOpen(false);

  return (
    <div className="ld" ref={rootRef} id="top">
      <header className={`ld-nav ${scrolled || open ? 'solid' : ''}`}>
        <div className="ld-nav-in">
          <a className="ld-logo" href="#top" aria-label="Env Literacy, back to top"><span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Leaf size={26} /></span>Env Literacy</a>
          <nav className={`ld-links ${open ? 'open' : ''}`} id="ld-menu" aria-label="Main">
            <a href="#about" onClick={close}>About</a><a href="#features" onClick={close}>Features</a><a href="#how" onClick={close}>How it works</a><a href="#partners" onClick={close}>Partners</a>
            <div className="ld-mobile-cta"><Link className="btn outline" to="/login">Log in</Link><Link className="btn" to="/register">Register</Link></div>
          </nav>
          <div className="ld-actions"><Link className="btn text" to="/login">Log in</Link><Link className="btn" to="/register">Register</Link></div>
          <button className="btn text ld-menu" aria-expanded={open} aria-controls="ld-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
        </div>
      </header>

      <main>
        <section className="ld-hero">
          <div className="ld-wrap ld-hero-grid">
            <div>
              <p className="ld-eyebrow reveal">Mira-Bhayandar · Schools and colleges</p>
              <h1 className="reveal d1">Know the planet. <em>Live like it.</em></h1>
              <p className="lead reveal d2">A calm way for schools and colleges to measure what students know about the environment, what they actually do, and how the gap closes over time.</p>
              <div className="ld-ctas reveal d3"><Link className="btn big" to="/register">Register</Link><a className="btn big outline" href="#how">See how it works</a></div>
            </div>
            <div className="ld-art reveal d2" aria-hidden="true">
              <div className="ld-blob" data-speed="0.04">
                <svg viewBox="0 0 400 420" preserveAspectRatio="xMidYMid slice">
                  <g fill="#F6F2E9" opacity=".16"><path d="M40 360C30 230 110 120 250 100c10 140-70 250-210 260Z" /><path d="M210 390c-10-110 40-200 150-230 12 110-40 200-150 230Z" /></g>
                  <g stroke="#F6F2E9" strokeOpacity=".45" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d="M60 350C110 270 160 200 240 130" /><path d="M222 380C250 320 300 250 350 175" /></g>
                  <g stroke="#DDE5D2" strokeOpacity=".5" strokeWidth="1" fill="none"><path d="M70 90h70l24 24h90" /><path d="M300 60v60l-22 22" strokeDasharray="3 5" /><path d="M110 300h60l20-20h70" /></g>
                  <g fill="#F6F2E9"><circle cx="70" cy="90" r="4" /><circle cx="254" cy="114" r="4" /><circle cx="300" cy="60" r="4" /><circle cx="110" cy="300" r="4" /><circle cx="260" cy="280" r="4" /></g>
                </svg>
                <span className="ld-drop" style={{ width: 54, height: 66, left: '16%', top: '14%' }} />
                <span className="ld-drop" style={{ width: 30, height: 38, left: '66%', top: '30%' }} />
                <span className="ld-drop" style={{ width: 22, height: 28, left: '40%', top: '68%' }} />
              </div>
              <div className="ld-chip" data-speed="-0.03" style={{ left: '-4%', bottom: '14%' }}><b>8</b> topics, one picture</div>
              <div className="ld-chip" data-speed="0.05" style={{ right: '-2%', top: '10%' }}><b>&lt;60s</b> weekly check-in</div>
            </div>
          </div>
        </section>
        <Divider />

        <section className="ld-about" id="about">
          <div className="ld-wrap ld-about-grid">
            <div className="reveal">
              <p className="ld-eyebrow">About the platform</p>
              <h2>Awareness is not the same as action.</h2>
              <p className="lead">Institutions run tree drives and awareness days, yet few can say whether students learn from them or change their habits. We measure both, and show the distance between them.</p>
              <div className="ld-facts">
                <div className="ld-fact"><span>Where</span><span>Mira-Bhayandar, Maharashtra</span></div>
                <div className="ld-fact"><span>Who</span><span>Grades 6–12 and college learners</span></div>
                <div className="ld-fact"><span>Rhythm</span><span>One quiz per term, one check-in per week</span></div>
                <div className="ld-fact"><span>Privacy</span><span>Regional views show aggregates only</span></div>
              </div>
            </div>
            <div className="ld-stats reveal d1">
              <div className="ld-stat"><b>8</b><span>topics, from waste to local wetlands</span></div>
              <div className="ld-stat"><b>5</b><span>roles, each with their own view</span></div>
              <div className="ld-stat"><b>3</b><span>gap states: aligned, knows more, acts more</span></div>
              <div className="ld-stat"><b>10</b><span>point campus sustainability audit</span></div>
            </div>
          </div>
        </section>

        <Divider tone="sage" flip />
        <section className="ld-features" id="features">
          <div className="ld-wrap">
            <p className="ld-eyebrow reveal">Featured technologies</p>
            <h2 className="reveal d1">Gentle tools, grounded in real habits.</h2>
            <p className="lead reveal d2">Technology stays in the background so learners and teachers can focus on the planet.</p>
            <div className="ld-cards">
              {FEATURES.map(([ic, t, d], i) => (
                <article className={`ld-card reveal d${(i % 3) + 1}`} key={t}><div className="ico"><Icon name={ic} /></div><h3>{t}</h3><p>{d}</p></article>
              ))}
            </div>
          </div>
        </section>
        <Divider tone="sage" />

        <section className="ld-tabs" id="how">
          <div className="ld-wrap">
            <p className="ld-eyebrow reveal">How it works</p>
            <h2 className="reveal d1">A simple rhythm for everyone.</h2>
            <div className="reveal d2"><Tabs /></div>
          </div>
        </section>

        <Divider tone="sage" flip />
        <section className="ld-partners" id="partners">
          <div className="ld-wrap">
            <p className="ld-eyebrow reveal">Built for</p>
            <h2 className="reveal d1">Made with the whole community.</h2>
            <p className="lead reveal d2">We are inviting pilot partners across Mira-Bhayandar to shape the platform together.</p>
            <div className="ld-pills reveal d3">
              {['Schools', 'Colleges', 'Municipal bodies', 'NGO partners', 'Environmental educators'].map(p => <span className="ld-pill" key={p}><i />{p}</span>)}
            </div>
          </div>
        </section>
        <Divider tone="sage" />

        <section className="ld-cta">
          <div className="ld-wrap">
            <h2 className="reveal">Ready to grow something good?</h2>
            <p className="reveal d1">Register your institution or join with a class code. It takes a couple of minutes.</p>
            <div className="ld-ctas reveal d2" style={{ justifyContent: 'center' }}><Link className="btn big" to="/register">Register</Link><Link className="btn big outline" to="/login">Log in</Link></div>
          </div>
        </section>
      </main>

      <footer className="ld-foot">
        <div className="ld-wrap">
          <div className="ld-foot-grid">
            <div><a className="ld-logo" href="#top"><span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Leaf size={24} /></span>Env Literacy</a>
              <p className="small muted mt1" style={{ maxWidth: '30ch' }}>Measuring what students know and what they do, for a greener Mira-Bhayandar.</p>
              <div className="ld-social">
                <Social label="Instagram"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5.5A3.5 3.5 0 1 0 12 15.500 3.5 3.5 0 0 0 12 8.500Zm5.200-2.200a.9.9 0 1 0 0 1.800.9.9 0 0 0 0-1.800Z" /></Social>
                <Social label="LinkedIn"><path d="M4 9h3.500v11H4V9Zm1.750-5.500a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM10 9h3.300v1.500c.5-.9 1.700-1.800 3.400-1.800 3.500 0 4.300 2.300 4.300 5.300V20h-3.500v-5.200c0-1.300 0-2.800-1.800-2.800s-2 1.300-2 2.700V20H10V9Z" /></Social>
                <Social label="YouTube"><path d="M21.500 8.200a2.700 2.700 0 0 0-1.900-1.900C18 5.900 12 5.900 12 5.900s-6 0-7.600.4A2.700 2.700 0 0 0 2.500 8.200C2.100 9.800 2.100 12 2.100 12s0 2.200.4 3.800a2.700 2.700 0 0 0 1.900 1.900c1.600.4 7.600.4 7.600.4s6 0 7.600-.4a2.700 2.700 0 0 0 1.900-1.900c.4-1.600.4-3.800.4-3.800s0-2.200-.4-3.800ZM10 14.800V9.200l4.800 2.800-4.800 2.800Z" /></Social>
              </div>
            </div>
            <div><h4>Explore</h4><ul><li><a href="#about">About</a></li><li><a href="#features">Features</a></li><li><a href="#how">How it works</a></li><li><a href="#partners">Partners</a></li></ul></div>
            <div><h4>Account</h4><ul><li><Link to="/register">Register</Link></li><li><Link to="/login">Log in</Link></li><li><Link to="/forgot">Reset password</Link></li></ul></div>
            <div><h4>Stay in the loop</h4><p className="small muted" style={{ margin: 0 }}>Occasional news from the pilot. No spam.</p><Newsletter /></div>
          </div>
          <div className="ld-legal"><span>© {new Date().getFullYear()} Environmental Literacy Platform</span><span>Mira-Bhayandar, Maharashtra</span></div>
        </div>
      </footer>
      <ChatWidget />
    </div>
  );
}
