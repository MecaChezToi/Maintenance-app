'use client'
import { useEffect, useRef } from 'react'

export default function LandingPage() {

  useEffect(() => {
    // Inject Google Fonts
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)

    // Bar chart
    const barData = [
      { mois: 'Jan', total: 2, crit: 1 },
      { mois: 'Fév', total: 2, crit: 0 },
      { mois: 'Mar', total: 2, crit: 1 },
      { mois: 'Avr', total: 2, crit: 1 },
      { mois: 'Mai', total: 2, crit: 0 },
    ]
    const maxVal = 3
    const bc = document.getElementById('barChart')
    if (bc && bc.childElementCount === 0) {
      barData.forEach(d => {
        const col = document.createElement('div')
        col.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;gap:2px'
        const totalH = Math.round((d.total / maxVal) * 90)
        const critH = Math.round((d.crit / maxVal) * 90)
        col.innerHTML = `
          <div style="display:flex;gap:2px;align-items:flex-end;height:90px">
            <div style="width:10px;height:${totalH}px;background:#00d0d8;border-radius:3px 3px 0 0;opacity:.7"></div>
            <div style="width:10px;height:${critH}px;background:#ef4444;border-radius:3px 3px 0 0"></div>
          </div>
          <div style="font-size:8px;color:#52525b;margin-top:3px">${d.mois}</div>
        `
        bc.appendChild(col)
      })
    }

    // Scroll reveal
    const reveals = document.querySelectorAll('.lp-reveal')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('lp-visible') })
    }, { threshold: 0.15 })
    reveals.forEach(r => observer.observe(r))

    // Counter animation
    function animateCount(el: HTMLElement, target: number, suffix: string, duration = 1400) {
      const start = performance.now()
      const update = (now: number) => {
        const progress = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        el.textContent = Math.round(ease * target) + suffix
        if (progress < 1) requestAnimationFrame(update)
      }
      requestAnimationFrame(update)
    }

    // Hero stats
    setTimeout(() => {
      const s1 = document.getElementById('stat1')
      const s2 = document.getElementById('stat2')
      const s3 = document.getElementById('stat3')
      const s4 = document.getElementById('stat4')
      if (s1) animateCount(s1, 96, '%')
      if (s2) animateCount(s2, 163, 'min')
      if (s3) animateCount(s3, 8, '')
      if (s4) animateCount(s4, 857, '€')
    }, 600)

    // Metrics counters
    const metricEls = document.querySelectorAll<HTMLElement>('.lp-metric-val[data-target]')
    const metricObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement
          const target = parseInt(el.dataset.target || '0')
          animateCount(el, target, '')
          metricObserver.unobserve(el)
        }
      })
    }, { threshold: 0.5 })
    metricEls.forEach(el => metricObserver.observe(el))

    return () => {
      observer.disconnect()
      metricObserver.disconnect()
    }
  }, [])

  return (
    <>
      <style>{`
        .lp-wrap { font-family: 'DM Sans', sans-serif; background: #09090b; color: #fafafa; overflow-x: hidden; }
        .lp-wrap * { box-sizing: border-box; margin: 0; padding: 0; }
        .lp-container { max-width: 1200px; margin: auto; padding: 0 32px; }

        /* NAV */
        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(9,9,11,.85); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,.07); }
        .lp-nav-inner { max-width: 1200px; margin: auto; padding: 0 32px; height: 68px; display: flex; align-items: center; justify-content: space-between; }
        .lp-logo { display: flex; align-items: center; gap: 10px; font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 800; color: #fafafa; text-decoration: none; }
        .lp-logo span { color: #00d0d8; }
        .lp-nav-links { display: flex; align-items: center; gap: 8px; }
        .lp-nav-links a { color: #a1a1aa; text-decoration: none; font-size: 14px; font-weight: 500; padding: 7px 14px; border-radius: 8px; transition: all .15s; }
        .lp-nav-links a:hover { color: #fafafa; background: rgba(255,255,255,.05); }
        .lp-nav-cta { background: #00d0d8 !important; color: #000 !important; font-weight: 700 !important; }
        .lp-nav-cta:hover { background: #00b0b8 !important; }

        /* HERO */
        .lp-hero { padding: clamp(80px,12vw,160px) 0 clamp(60px,8vw,100px); position: relative; overflow: hidden; }
        .lp-hero::before { content: ''; position: absolute; top: -200px; right: -200px; width: 800px; height: 800px; border-radius: 50%; background: radial-gradient(circle, rgba(124,58,237,.1) 0%, transparent 65%); pointer-events: none; }
        .lp-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px; background: rgba(0,208,216,.06); border: 1px solid rgba(0,208,216,.25); color: #00d0d8; font-size: 13px; font-weight: 600; margin-bottom: 32px; animation: lp-fadeUp .6s ease both; }
        .lp-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: #00d0d8; animation: lp-pulse 2s infinite; }
        @keyframes lp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
        @keyframes lp-fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .lp-h1 { font-family: 'Inter', sans-serif; font-size: clamp(32px, 8vw, 72px); font-weight: 800; line-height: 1.05; letter-spacing: -1px; max-width: 860px; animation: lp-fadeUp .7s .1s ease both; }
        .lp-h1 .green { color: #00d0d8; }
        .lp-h1 .dim { color: #3f3f46; }
        .lp-sub { font-size: 20px; color: #a1a1aa; max-width: 620px; line-height: 1.65; margin-top: 24px; animation: lp-fadeUp .7s .2s ease both; }
        .lp-btns { display: flex; gap: 14px; margin-top: 40px; flex-wrap: wrap; animation: lp-fadeUp .7s .3s ease both; }
        .lp-btn-p { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 12px; background: #00d0d8; color: #000; font-weight: 700; font-size: 15px; text-decoration: none; transition: all .15s; }
        .lp-btn-p:hover { background: #00b0b8; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,208,216,.25); }
        .lp-btn-s { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 12px; border: 1px solid rgba(255,255,255,.12); color: #fafafa; font-weight: 600; font-size: 15px; text-decoration: none; transition: all .15s; }
        .lp-btn-s:hover { border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.04); }

        /* STATS */
        .lp-stats { display: flex; gap: 40px; margin-top: 56px; animation: lp-fadeUp .7s .4s ease both; flex-wrap: wrap; }
        .lp-stat-val { font-family: Arial, Helvetica, sans-serif; font-size: clamp(22px,5vw,32px); font-weight: 700; color: #00d0d8; }
        .lp-stat-lbl { font-size: 13px; color: #a1a1aa; margin-top: 2px; }

        /* DASHBOARD PREVIEW */
        .lp-preview { margin-top: 80px; display: none; } @media(min-width:769px){.lp-preview{display:block; margin-top: 80px; background: #18181b; border: 1px solid rgba(255,255,255,.12); border-radius: 24px; overflow: hidden; box-shadow: 0 40px 120px rgba(0,0,0,.6); animation: lp-fadeUp .8s .5s ease both; position: relative; }
        .lp-preview::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(0,208,216,.4), transparent); }
        .lp-browser { background: #0f0f11; border-bottom: 1px solid rgba(255,255,255,.07); padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
        .lp-dots { display: flex; gap: 6px; }
        .lp-dots span { width: 12px; height: 12px; border-radius: 50%; }
        .lp-url { flex: 1; background: #1f2024; border-radius: 6px; padding: 5px 12px; font-size: 12px; color: #52525b; font-family: monospace; max-width: 320px; }
        .lp-dash { display: flex; height: 520px; overflow: hidden; }
        .lp-sidebar { width: 200px; min-width: 200px; background: #0f0f11; border-right: 1px solid rgba(255,255,255,.07); padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; }
        .lp-dash-logo { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 12px; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 16px; color: #00d0d8; }
        .lp-nav-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; font-size: 12px; color: #a1a1aa; }
        .lp-nav-item.on { background: rgba(124,58,237,.15); color: #fafafa; border-left: 2px solid #00d0d8; }
        .lp-main { flex: 1; overflow: hidden; padding: 20px; background: #09090b; display: flex; flex-direction: column; gap: 14px; }
        .lp-kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
        .lp-kpi { background: #111113; border: 1px solid rgba(255,255,255,.07); border-radius: 10px; padding: 14px; }
        .lp-kpi-val { font-family: 'Inter', sans-serif; font-size: 26px; font-weight: 800; line-height: 1; }
        .lp-kpi-lbl { font-size: 9px; color: #a1a1aa; text-transform: uppercase; letter-spacing: .8px; margin-top: 4px; }
        .lp-kpi-trend { font-size: 10px; margin-top: 6px; font-weight: 600; }
        .lp-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
        .lp-chart { background: #111113; border: 1px solid rgba(255,255,255,.07); border-radius: 10px; padding: 14px; overflow: hidden; display: flex; flex-direction: column; }
        .lp-chart-title { font-size: 11px; font-weight: 700; margin-bottom: 10px; }
        .lp-bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 100px; padding-bottom: 8px; }
        .lp-alert { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; font-size: 11px; background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2); color: #fca5a5; }
        .lp-int-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: #1f2024; border-radius: 6px; font-size: 11px; margin-bottom: 5px; }
        .lp-int-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .lp-int-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
        .lp-int-badge { font-size: 9px; padding: 2px 7px; border-radius: 10px; font-weight: 700; flex-shrink: 0; }

        /* SECTIONS */
        .lp-section { padding: clamp(48px,8vw,100px) 0; }
        .lp-section-badge { display: inline-flex; padding: 6px 14px; border-radius: 999px; background: rgba(0,208,216,.06); border: 1px solid rgba(0,208,216,.2); color: #00d0d8; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
        .lp-section-title { font-family: 'Inter', sans-serif; font-size: clamp(28px,6vw,48px); font-weight: 800; letter-spacing: -1.5px; line-height: 1.08; }
        .lp-section-sub { color: #a1a1aa; font-size: 18px; margin-top: 16px; max-width: 560px; line-height: 1.65; }

        /* FEATURES */
        .lp-features { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.07); border-radius: 20px; overflow: hidden; margin-top: 60px; }
        @media(max-width:768px){ .lp-features { grid-template-columns: 1fr; } }
        .lp-feature { background: #111113; padding: 36px 32px; transition: background .2s; }
        @media(max-width:768px){ .lp-feature { padding: 20px 18px; } }
        .lp-feature:hover { background: #18181b; }
        .lp-feature-icon { width: 44px; height: 44px; border-radius: 10px; background: rgba(0,208,216,.06); border: 1px solid rgba(0,208,216,.2); display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 20px; }
        .lp-feature-title { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 10px; }
        .lp-feature-desc { color: #a1a1aa; font-size: 14px; line-height: 1.65; }

        /* METRICS */
        .lp-metrics { padding: 100px 0; background: linear-gradient(135deg, #111113 0%, #09090b 50%, #111113 100%); border-top: 1px solid rgba(255,255,255,.07); border-bottom: 1px solid rgba(255,255,255,.07); }
        .lp-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 1px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.07); border-radius: 20px; overflow: hidden; }
        .lp-metric { background: #111113; padding: 40px 32px; text-align: center; }
        .lp-metric-val { font-family: Arial, Helvetica, sans-serif; font-size: 52px; font-weight: 700; color: #00d0d8; line-height: 1; }
        .lp-metric-unit { font-family: Arial, Helvetica, sans-serif; font-size: 28px; color: #00d0d8; }
        .lp-metric-lbl { color: #a1a1aa; font-size: 15px; margin-top: 10px; }

        /* PRICING */
        .lp-pricing-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 60px; }
        .lp-price-card { background: #18181b; border: 1px solid rgba(255,255,255,.07); border-radius: 20px; padding: 32px; transition: all .2s; position: relative; overflow: hidden; }
        .lp-price-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,.12); }
        .lp-price-card.featured { border-color: #00d0d8; background: #111113; }
        .lp-price-card.featured::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: #00d0d8; }
        .lp-price-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; background: #00d0d8; color: #000; font-size: 11px; font-weight: 700; margin-bottom: 20px; }
        .lp-price-name { font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .lp-price-val { font-family: Arial, Helvetica, sans-serif; font-size: 44px; font-weight: 800; line-height: 1; }
        .lp-price-val span { font-size: 16px; color: #a1a1aa; font-family: 'DM Sans', sans-serif; font-weight: 400; }
        .lp-price-period { font-size: 12px; color: #a1a1aa; margin: 8px 0 24px; }
        .lp-price-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
        .lp-price-features li { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #a1a1aa; }
        .lp-price-features li::before { content: '✓'; color: #00d0d8; font-weight: 700; flex-shrink: 0; }
        .lp-price-features li.na::before { content: '—'; color: #3f3f46; }
        .lp-price-features li.na { color: #3f3f46; }

        /* CTA */
        .lp-cta-box { background: #18181b; border: 1px solid rgba(255,255,255,.12); border-radius: 28px; padding: 72px 60px; text-align: center; position: relative; overflow: hidden; }
        .lp-cta-box::before { content: ''; position: absolute; top: -200px; left: 50%; transform: translateX(-50%); width: 600px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(124,58,237,.15) 0%, transparent 65%); pointer-events: none; }
        .lp-cta-title { font-family: 'Inter', sans-serif; font-size: 52px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.05; margin-bottom: 20px; }
        .lp-cta-sub { color: #a1a1aa; font-size: 18px; margin-bottom: 40px; }

        /* REVEAL */
        .lp-reveal { opacity: 0; transform: translateY(32px); transition: opacity .6s ease, transform .6s ease; }
        .lp-visible { opacity: 1; transform: translateY(0); }

        /* FOOTER */
        .lp-footer { border-top: 1px solid rgba(255,255,255,.07); padding: 48px 0; }
        .lp-footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .lp-footer-logo { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 800; }
        .lp-footer-logo span { color: #00d0d8; }

        /* RESPONSIVE */
        @media(max-width:900px) {
          .lp-h1 { font-size: 42px; letter-spacing: -1px; }
          .lp-section-title { font-size: 36px; }
          .lp-features { grid-template-columns: 1fr; }
          .lp-metrics-grid { grid-template-columns: 1fr 1fr; }
          .lp-pricing-grid { grid-template-columns: 1fr; }
          .lp-cta-title { font-size: 36px; }
          .lp-cta-box { padding: 40px 24px; }
          .lp-sidebar { display: none; }
          .lp-kpi-row { grid-template-columns: 1fr 1fr; }
          .lp-charts { grid-template-columns: 1fr; }
          .lp-dash { height: auto; }
        }
      `}</style>

      <div className="lp-wrap">

        {/* NAV */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <a href="/" className="lp-logo">
              <img src="/logo.png" alt="MaintaFood" style={{ height: 72, objectFit: 'contain' }} />
            </a>
            <div className="lp-nav-links">
              <a href="#features">Fonctionnalités</a>
              <a href="#pricing">Tarifs</a>
              <a href="/auth" className="lp-nav-cta">Se connecter →</a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-container">
            <div className="lp-badge">
              <span className="lp-badge-dot"></span>
              Version bêta active · Développé en Belgique 🇧🇪
            </div>

            <h1 className="lp-h1">
              La GMAO conçue pour<br/>
              <span className="green">l&apos;industrie</span> <span className="dim">agroalimentaire</span>
            </h1>

            <p className="lp-sub">
              Réduisez les arrêts de ligne, simplifiez vos audits HACCP et centralisez votre maintenance sur une seule plateforme moderne.
            </p>

            <div className="lp-btns">
              <a href="/auth" className="lp-btn-p">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                Demander une démo
              </a>
              <a href="#features" className="lp-btn-s">Voir les fonctionnalités</a>
            </div>

            <div className="lp-stats">
              <div><div className="lp-stat-val" id="stat1">0%</div><div className="lp-stat-lbl">Conformité IFS</div></div>
              <div style={{width:1,background:'rgba(255,255,255,.07)'}}></div>
              <div><div className="lp-stat-val" id="stat2">0min</div><div className="lp-stat-lbl">Durée moy. intervention</div></div>
              <div style={{width:1,background:'rgba(255,255,255,.07)'}}></div>
              <div><div className="lp-stat-val" id="stat3">0</div><div className="lp-stat-lbl">Rapports ce mois</div></div>
              <div style={{width:1,background:'rgba(255,255,255,.07)'}}></div>
              <div><div className="lp-stat-val" id="stat4">0€</div><div className="lp-stat-lbl">Valeur stock suivi</div></div>
            </div>

            {/* Dashboard preview */}
            <div className="lp-preview">
              <div className="lp-browser">
                <div className="lp-dots">
                  <span style={{background:'#ef4444'}}></span>
                  <span style={{background:'#f59e0b'}}></span>
                  <span style={{background:'#00d0d8'}}></span>
                </div>
                <div className="lp-url">app.maintafood.io/dashboard</div>
              </div>
              <div className="lp-dash">
                <div className="lp-sidebar">
                  <div className="lp-dash-logo">
                    <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
                      <circle cx="32" cy="32" r="30" stroke="#00d0d8" strokeWidth="5"/>
                      <path d="M20 34c6-14 18-14 24 0" stroke="#00d0d8" strokeWidth="5" strokeLinecap="round"/>
                      <path d="M26 38h12" stroke="#00d0d8" strokeWidth="5" strokeLinecap="round"/>
                    </svg>
                    MaintaFood
                  </div>
                  {[['🏠','Dashboard',true],['🗺','Plan du site',false],['🔧','Interventions',false],['📦','Magasin',false],['📋','Audit',false]].map(([icon,label,active]) => (
                    <div key={label as string} className={`lp-nav-item${active?' on':''}`}>{icon} {label}</div>
                  ))}
                </div>
                <div className="lp-main">
                  <div style={{fontFamily:"'Inter',sans-serif",fontSize:18,fontWeight:700}}>Bonjour, Alexandre 👋</div>
                  <div style={{fontSize:11,color:'#a1a1aa'}}>Usine Agroalimentaire Nord · IFS Food v8</div>
                  <div className="lp-alert">🛡 1 intervention avec risque alimentaire — action requise</div>
                  <div className="lp-kpi-row">
                    {[['8','#00d0d8','Clôturés','▲ 10 total'],['96%','#00d0d8','Conformité','IFS/BRC ✓'],['163','#3b82f6','Durée moy.','min / OT'],['2','#ef4444','Alertes alim.','⚠ Action req.']].map(([v,c,l,t]) => (
                      <div key={l as string} className="lp-kpi">
                        <div className="lp-kpi-val" style={{color:c as string}}>{v}</div>
                        <div className="lp-kpi-lbl">{l}</div>
                        <div className="lp-kpi-trend" style={{color:c as string}}>{t}</div>
                      </div>
                    ))}
                  </div>
                  <div className="lp-charts">
                    <div className="lp-chart">
                      <div className="lp-chart-title">📊 Interventions par mois</div>
                      <div className="lp-bar-chart" id="barChart"></div>
                    </div>
                    <div className="lp-chart">
                      <div className="lp-chart-title">🔧 Dernières interventions</div>
                      {[['#ef4444','Panne vanne solénoïde doseuse','rgba(239,68,68,.1)','#ef4444','CRITIQUE'],['#00d0d8','Maintenance préventive compresseur','rgba(168,85,247,.1)','#a855f7','VALIDÉ'],['#3b82f6','Contrôle convoyeur ligne A','rgba(59,130,246,.1)','#3b82f6','EN COURS'],['#f59e0b','Fuite circuit hydraulique CNC','rgba(245,158,11,.1)','#f59e0b','À FAIRE']].map(([dc,title,bg,tc,badge]) => (
                        <div key={title as string} className="lp-int-item">
                          <div className="lp-int-dot" style={{background:dc as string}}></div>
                          <div className="lp-int-title">{title}</div>
                          <div className="lp-int-badge" style={{background:bg as string,color:tc as string}}>{badge}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="lp-section">
          <div className="lp-container">
            <div className="lp-reveal">
              <div className="lp-section-badge">Fonctionnalités</div>
              <h2 className="lp-section-title">Tout ce dont vous<br/>avez besoin</h2>
            </div>
            <div className="lp-features lp-reveal">
              {[['📊','Dashboard KPI','Taux de conformité IFS, MTBF, durée moyenne — tous vos indicateurs sur un seul écran.'],['🔧','Gestion des interventions','Créez, assignez et suivez vos OT. Rapport multi-étapes avec signature numérique horodatée.'],['📄','Rapports PDF certifiés','Chaque intervention génère un PDF professionnel avec checklist HACCP — prêt pour l\'inspecteur.'],['🛡','Conformité IFS·BRC·ISO','Journal d\'audit horodaté, traçabilité complète, alertes risque alimentaire automatiques.'],['📦','Gestion du magasin','Stocks en temps réel, alertes rupture, localisation par zone, historique des mouvements.'],['📱','100% mobile terrain','Interface optimisée smartphone. Vos techniciens remplissent leurs rapports sur le terrain.']].map(([icon,title,desc]) => (
                <div key={title as string} className="lp-feature">
                  <div className="lp-feature-icon">{icon}</div>
                  <div className="lp-feature-title">{title}</div>
                  <div className="lp-feature-desc">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* METRICS */}
        <section className="lp-metrics">
          <div className="lp-container">
            <div className="lp-metrics-grid lp-reveal">
              {[['96','%','Taux de conformité moyen'],['163','min','Durée moyenne d\'intervention'],['30','%','Réduction des arrêts ligne'],['5','min','Pour générer un rapport PDF']].map(([val,unit,lbl]) => (
                <div key={lbl as string} className="lp-metric">
                  <div><span className="lp-metric-val" data-target={val}>{val}</span><span className="lp-metric-unit">{unit}</span></div>
                  <div className="lp-metric-lbl">{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="lp-section">
          <div className="lp-container">
            <div className="lp-reveal" style={{textAlign:'center'}}>
              <div className="lp-section-badge">Tarifs</div>
              <h2 className="lp-section-title">Transparent, sans surprise</h2>
              <p className="lp-section-sub" style={{margin:'16px auto 0',textAlign:'center'}}>Pas de frais cachés. Résiliable à tout moment.</p>
            </div>
            <div className="lp-pricing-grid lp-reveal" style={{gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:24}}>
              {/* Starter */}
              <div className="lp-price-card">
                <div className="lp-price-name">Starter</div>
                <div className="lp-price-val">99<span>€</span></div>
                <div className="lp-price-period">/ mois · HTVA</div>
                <ul className="lp-price-features">
                  <li>2 utilisateurs</li>
                  <li>Interventions illimitées</li>
                  <li>Rapports PDF certifiés</li>
                  <li>Dashboard KPI complet</li>
                  <li>Gestion du stock</li>
                  <li>Audit IFS/BRC</li>
                  <li>Maintenance préventive</li>
                  <li>Plan du site</li>
                  <li className="na">Multi-sites</li>
                </ul>
                <a href="/auth" className="lp-btn-s" style={{width:'100%',justifyContent:'center',textAlign:'center',display:'flex'}}>Commencer</a>
              </div>
              {/* PME */}
              <div className="lp-price-card featured">
                <div className="lp-price-badge">⭐ PME</div>
                <div className="lp-price-name">PME</div>
                <div className="lp-price-val">149<span>€</span></div>
                <div className="lp-price-period">/ mois · HTVA · Résiliable à tout moment</div>
                <ul className="lp-price-features">
                  <li>8 utilisateurs</li>
                  <li>Interventions illimitées</li>
                  <li>Rapports PDF certifiés</li>
                  <li>Dashboard KPI complet</li>
                  <li>Gestion du stock</li>
                  <li>Audit IFS/BRC intégré</li>
                  <li>Maintenance préventive</li>
                  <li>Plan du site</li>
                  <li>Multi-sites</li>
                </ul>
                <a href="/auth" className="lp-btn-p" style={{width:'100%',justifyContent:'center',textAlign:'center',display:'flex'}}>Essayer 30 jours gratuit</a>
              </div>
              {/* Enterprise */}
              <div className="lp-price-card">
                <div className="lp-price-name">Enterprise</div>
                <div className="lp-price-val" style={{fontSize:32,paddingTop:8}}>Sur devis</div>
                <div className="lp-price-period">contactez-nous</div>
                <ul className="lp-price-features">
                  <li>15+ utilisateurs</li>
                  <li>Multi-sites</li>
                  <li>Toutes les fonctionnalités</li>
                  <li>API & intégrations</li>
                  <li>SSO</li>
                  <li>Support dédié</li>
                </ul>
                <a href="mailto:contact@maintafood.io" className="lp-btn-s" style={{width:'100%',justifyContent:'center',textAlign:'center',display:'flex'}}>Nous contacter</a>
              </div>
            </div>
            {/* Mise en service */}
            <div className="lp-reveal" style={{marginTop:32,padding:'28px 36px',background:'rgba(0,208,216,.04)',border:'1px solid rgba(0,208,216,.15)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:20}}>
              <div>
                <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>🚀 Mise en service</div>
                <div style={{fontSize:14,color:'#a1a1aa',maxWidth:520,lineHeight:1.6}}>Import des équipements, configuration, formation et accompagnement au démarrage inclus.</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'Arial,Helvetica,sans-serif',fontSize:36,fontWeight:700,color:'#00d0d8',lineHeight:1}}>1 250€</div>
                <div style={{fontSize:12,color:'#a1a1aa',marginTop:4}}>HTVA · paiement unique</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-cta-box lp-reveal">
              <h2 className="lp-cta-title">Prêt pour la<br/><span style={{color:'#00d0d8'}}>maintenance intelligente ?</span></h2>
              <p className="lp-cta-sub">Essai gratuit 30 jours · Aucune carte de crédit · Données hébergées en Europe</p>
              <div style={{display:'flex',justifyContent:'center',gap:14,flexWrap:'wrap'}}>
                <a href="/auth" className="lp-btn-p" style={{fontSize:16,padding:'16px 32px'}}>Demander une démo gratuite →</a>
                <a href="/auth" className="lp-btn-s" style={{fontSize:16,padding:'16px 32px'}}>Se connecter</a>
              </div>
              <div style={{marginTop:32,display:'flex',justifyContent:'center',gap:32,flexWrap:'wrap'}}>
                {['Conforme IFS Food v8','Conforme BRC','RGPD · Hébergé en Europe','Développé en Belgique 🇧🇪'].map(t => (
                  <div key={t} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#a1a1aa'}}>
                    <span style={{color:'#00d0d8'}}>✓</span> {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div className="lp-container">
            <div className="lp-footer-inner">
              <img src="/logo.png" alt="MaintaFood" style={{ height: 28, objectFit: 'contain' }} />
              <div style={{color:'#3f3f46',fontSize:13}}>GMAO agroalimentaire · Version bêta · Belgique 🇧🇪</div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#a1a1aa',background:'#18181b',border:'1px solid rgba(255,255,255,.07)',borderRadius:8,padding:'6px 12px'}}>🛡 IFS · BRC · ISO 22000</div>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
