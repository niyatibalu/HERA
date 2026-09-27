// HERA care access map. Plain JS + vendored Leaflet so it runs with no build step and no internet.
// URL params: ?patient_id=maya-001&provider_id=prov-alt-best&api=http://127.0.0.1:8001
;(function () {
  'use strict'

  const params = new URLSearchParams(location.search)
  const API = (params.get('api') || '').replace(/\/$/, '')
  const PATIENT_ID = params.get('patient_id') || 'maya-001'
  // Embedding inside the HERA web app:
  //   embed=1  compact: map + routes only (travel step)
  //   inapp=1  full map with side panel, minus the page title the app already shows
  //   theme=light|dark  match the host app
  const EMBED = params.get('embed') === '1'
  const INAPP = params.get('inapp') === '1'
  if (EMBED) document.body.classList.add('embed')
  if (INAPP) document.body.classList.add('inapp')
  if (['light', 'dark'].includes(params.get('theme'))) document.documentElement.dataset.theme = params.get('theme')
  const inFrame = window.parent !== window
  const tellParent = (msg) => { if (inFrame) window.parent.postMessage({ source: 'hera-map', ...msg }, '*') }
  const JOURNEY_ID = params.get('journey_id') || ''

  const $ = (id) => document.getElementById(id)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const humanize = (s) => String(s || '').replace(/_/g, ' ')
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  async function getJSON(path) {
    const res = await fetch(API + path)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.detail || `${path} → ${res.status}`)
    return body
  }

  // ---------- map ----------
  const map = L.map('map', { zoomControl: true, preferCanvas: false })
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  })
  let tileErrors = 0
  let tileLoads = 0
  tiles.on('tileerror', () => {
    tileErrors++
    if (tileErrors >= 3 && tileLoads === 0) showOffline()
  })
  tiles.on('tileload', () => {
    tileLoads++
    $('offline-banner').hidden = true
  })
  tiles.addTo(map)
  if (!navigator.onLine) showOffline()

  const layers = {
    towns: L.layerGroup(),
    facilities: L.layerGroup().addTo(map),
    providers: L.layerGroup().addTo(map),
    patient: L.layerGroup().addTo(map),
  }
  function showOffline() {
    $('offline-banner').hidden = false
    layers.towns.addTo(map) // town labels give the blank basemap some orientation
  }

  const dotIcon = (color, size = 14, ring = '#fff') =>
    L.divIcon({
      className: '',
      iconSize: [size, size],
      html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${ring};box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
    })

  const state = { world: null, selected: null, providerMarkers: {} }

  function drawWorld(world) {
    const p = world.patient
    const home = [p.home_location.lat, p.home_location.lon]
    L.marker(home, { icon: dotIcon(css('--patient'), 18), zIndexOffset: 1000, title: 'Patient home' })
      .bindTooltip(`<b>${esc(p.name?.split(' ')[0] || 'Patient')}'s home</b><br>${esc(p.home_location.address)}`)
      .addTo(layers.patient)

    for (const t of world.towns) {
      L.tooltip({ permanent: true, direction: 'center', className: 'town-label' }).setLatLng([t.lat, t.lon]).setContent(esc(t.name)).addTo(layers.towns)
    }
    for (const f of world.facilities) {
      const ld = (f.services || []).includes('labor_delivery')
      const color = ld ? css('--ld') : f.kind === 'hospital_er' ? css('--hospital') : css('--urgent')
      L.marker([f.lat, f.lon], { icon: dotIcon(color, ld ? 12 : 10), title: f.name })
        .bindTooltip(`<b>${esc(f.name)}</b><br>${esc(humanize(f.kind === 'hospital_er' ? 'hospital / emergency' : f.kind))}${ld ? '<br>Labor &amp; delivery care' : ''}`)
        .addTo(layers.facilities)
    }
    for (const pr of world.providers) {
      const isOriginal = pr.role === 'original'
      const m = L.marker([pr.location.lat, pr.location.lon], {
        icon: dotIcon(isOriginal ? css('--original') : css('--alt'), 16),
        zIndexOffset: 500,
        title: pr.name,
      })
        .bindTooltip(`<b>${esc(pr.name)}</b>${isOriginal ? ' · original referral' : ''}<br>${esc(humanize(pr.specialty))} · ${esc(pr.location.address)}<br>${pr.distance_mi} mi · ${pr.wait_days}-day wait`)
        .on('click', () => selectProvider(pr.provider_id))
        .addTo(layers.providers)
      state.providerMarkers[pr.provider_id] = m
    }
    const bounds = L.latLngBounds([home, ...world.providers.map((x) => [x.location.lat, x.location.lon])])
    map.fitBounds(bounds, { padding: [30, 30] })
  }

  function renderHeader(world) {
    const p = world.patient
    $('patient-title').textContent = `${p.name || p.patient_id}`
    $('patient-sub').textContent = `${p.home_location.address} · ${p.insurance_plan || 'insurance unknown'}`
    const chips = []
    for (const c of [...(p.mobility_constraints || []), ...(p.accessibility_needs || [])]) chips.push(`<span class="chip">${esc(humanize(c))}</span>`)
    $('status-chips').innerHTML = chips.join('')
  }

  function renderProviders(world) {
    $('provider-list').innerHTML = world.providers
      .map((pr) => {
        const tag = pr.role === 'original' ? '<span class="tag tag-original">Original referral</span>' : '<span class="tag tag-alt">Alternative</span>'
        const net = pr.in_network_plans?.includes(world.patient.insurance_plan) ? 'in network' : 'out of network'
        return `<li><button type="button" class="prov" data-id="${esc(pr.provider_id)}" aria-pressed="false">
          <span class="prov-name">${esc(pr.name)}</span><span class="prov-dist">${pr.distance_mi} mi</span>
          <span class="prov-meta">${tag}${esc(humanize(pr.specialty))} · ${esc(pr.location.address)} · ${pr.wait_days}-day wait · ${net}${pr.telehealth_available ? ' · telehealth' : ''}</span>
        </button></li>`
      })
      .join('')
    for (const b of $('provider-list').querySelectorAll('.prov')) b.addEventListener('click', () => selectProvider(b.dataset.id))
  }

  function selectProvider(providerId) {
    state.selected = providerId
    for (const b of $('provider-list').querySelectorAll('.prov')) b.setAttribute('aria-pressed', String(b.dataset.id === providerId))
    const pr = state.world.providers.find((x) => x.provider_id === providerId)
    if (!pr) return
    const home = state.world.patient.home_location
    map.fitBounds(L.latLngBounds([[home.lat, home.lon], [pr.location.lat, pr.location.lon]]), { padding: [60, 60], maxZoom: 14 })
    if (!EMBED) state.providerMarkers[providerId]?.openTooltip() // keep the compact embed uncluttered
    const url = new URL(location.href)
    url.searchParams.set('provider_id', providerId)
    history.replaceState(null, '', url)
    loadRoutes(providerId)
  }

  // ---------- routes ----------
  const MODE_COLOR = { fastest: '--r-fastest', safer: '--r-safer', transit: '--r-transit' }
  const FACTOR_LABEL = {
    travel_time_score: 'Travel time', weather_score: 'Weather', road_condition_score: 'Road condition',
    construction_score: 'Construction', road_type_score: 'Road type', isolation_score: 'Isolation',
    healthcare_proximity_score: 'Healthcare nearby', accessibility_score: 'Accessibility',
    mobility_fit_score: 'Mobility fit', transit_service_score: 'Transit service',
  }
  const routeLayer = L.layerGroup().addTo(map)
  const RISKY = /snow|sleet|ice|freezing|unplowed|closure|construction|no services|not step-free/i
  let routeReq = 0

  async function loadRoutes(providerId) {
    const req = ++routeReq
    $('routes-block').hidden = false
    $('route-list').innerHTML = '<p class="hint">Scoring routes…</p>'
    routeLayer.clearLayers()
    let data
    try {
      const q = new URLSearchParams({ patient_id: PATIENT_ID, provider_id: providerId })
      if (JOURNEY_ID) q.set('journey_id', JOURNEY_ID)
      for (const k of ['weights', 'date']) if (params.get(k)) q.set(k, params.get(k))
      q.set('scenario', $('scenario').value)
      if ($('pregnant').checked) q.set('pregnant', '1')
      data = await getJSON(`/routes?${q}`)
    } catch (e) {
      if (req === routeReq) $('route-list').innerHTML = `<p class="error">Could not load routes: ${esc(e.message || e)}</p>`
      return
    }
    if (req !== routeReq) return // a newer selection won
    state.routes = data
    const rec = data.options.find((o) => o.recommended) || data.options[0]
    const wanted = params.get('route')
    state.selectedRoute = data.options.some((o) => o.route_id === wanted) ? wanted : rec?.route_id
    $('routes-sub').textContent = `To ${data.destination} · appointment ${data.appointment_date}`
    $('disclaimer').textContent = data.disclaimer
    renderRoutes()
    renderConditions(data.conditions)
    renderPregnancy(data.pregnancy)
  }

  function renderRoutes() {
    const data = state.routes
    routeLayer.clearLayers()
    const drawn = []
    // Draw unselected first so the selected route sits on top.
    const ordered = [...data.options].sort((a, b) => (a.route_id === state.selectedRoute) - (b.route_id === state.selectedRoute))
    for (const o of ordered) {
      if (!o.geometry.length) continue
      const on = o.route_id === state.selectedRoute
      const color = css(MODE_COLOR[o.mode] || '--muted')
      if (on) L.polyline(o.geometry, { color: '#fff', weight: 10, opacity: 0.9 }).addTo(routeLayer)
      L.polyline(o.geometry, { color, weight: on ? 6 : 4, opacity: on ? 1 : 0.55, dashArray: o.mode === 'transit' ? '2 8' : null })
        .bindTooltip(`<b>${esc(o.label)}</b><br>${esc(o.name)} · ${o.duration_minutes} min`, { sticky: true })
        .on('click', () => selectRoute(o.route_id))
        .addTo(routeLayer)
      drawn.push(...o.geometry)
    }
    if (drawn.length) map.fitBounds(L.latLngBounds(drawn), { padding: [40, 40], maxZoom: 15 })

    $('route-list').innerHTML = data.options
      .map((o) => {
        const on = o.route_id === state.selectedRoute
        const time = o.duration_minutes != null ? `${o.duration_minutes} <small>min</small>` : '<small>No travel</small>'
        const factors = Object.entries(o.factor_scores || {})
          .map(([k, v]) => `<div class="factor"><span>${esc(FACTOR_LABEL[k] || k)}</span><span class="bar"><span style="width:${Math.round(v * 100)}%"></span></span><span class="factor-val">${Math.round(v * 100)}</span></div>`)
          .join('')
        return `<button type="button" class="route ${o.recommended ? 'is-recommended' : ''}" role="radio" aria-checked="${on}" data-id="${esc(o.route_id)}" style="--mode-color:${css(MODE_COLOR[o.mode] || '--line')}">
          <div class="route-top"><span class="route-label">${esc(o.label)}</span>${o.recommended ? '<span class="badge rec">Recommended</span>' : o.suggested ? '<span class="badge rec">Suggested</span>' : o.score != null ? `<span class="score">score ${Math.round(o.score)}</span>` : ''}</div>
          <div class="route-time">${time}${o.distance_mi ? ` <small>· ${o.distance_mi} mi</small>` : ''}</div>
          <div class="route-summary">${esc(o.name)}${o.weather_risk !== 'none' ? ` · weather risk: ${esc(o.weather_risk)}` : ''}${o.mode !== 'telehealth' && o.mode !== 'transit' ? ` · construction: ${o.construction ? 'yes' : 'none reported'}` : ''}</div>
          <div class="conds">${o.conditions.map((c) => `<span class="badge ${RISKY.test(c) ? 'risk' : /major roads|passes|step-free|no travel/i.test(c) ? 'ok' : ''}">${esc(c)}</span>`).join('')}</div>
          ${on && o.reasons.length ? `<ul class="reasons">${o.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
          ${on && o.cautions.length ? `<ul class="reasons">${o.cautions.map((r) => `<li class="error">${esc(r)}</li>`).join('')}</ul>` : ''}
          ${on && o.pregnancy_check ? `<ul class="preg-check" aria-label="Pregnancy check">${o.pregnancy_check.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✕'} ${esc(c.label)}</li>`).join('')}</ul>` : ''}
          ${on && factors ? `<div class="factors" aria-label="Factor scores">${factors}</div>` : ''}
        </button>`
      })
      .join('')
    for (const b of $('route-list').querySelectorAll('.route')) b.addEventListener('click', () => selectRoute(b.dataset.id))
  }

  function selectRoute(routeId, fromParent = false) {
    if (!state.routes?.options.some((o) => o.route_id === routeId)) return
    state.selectedRoute = routeId
    renderRoutes()
    if (!fromParent) tellParent({ type: 'routeSelected', route_id: routeId })
  }

  // The host app can highlight a route without reloading the frame.
  window.addEventListener('message', (e) => {
    const m = e.data
    if (!m || m.source !== 'hera-app' || typeof m.route_id !== 'string') return
    if (m.type === 'selectRoute') selectRoute(m.route_id, true)
  })

  function renderPregnancy(p) {
    const box = $('pregnancy-tips')
    if (!p) { box.hidden = true; return }
    box.hidden = false
    const ld = p.labor_delivery_near_destination.map((f) => `${esc(f.name)} (${f.distance_mi} mi)`).join(', ')
    box.innerHTML = `<h3>Traveling while pregnant</h3><ul>${p.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` +
      (ld ? `<p class="ld">Labor &amp; delivery near your destination: ${ld}</p>` : '') + `<p>${esc(p.note)}</p>`
  }

  const condLayer = L.layerGroup().addTo(map)
  function renderConditions(cond) {
    condLayer.clearLayers()
    if (!cond) return
    for (const z of cond.weather || []) {
      L.circle([z.lat, z.lon], { radius: z.radius_mi * 1609.34, color: '#7aa7d9', weight: 1, fillColor: '#9cc3ee', fillOpacity: 0.12 + z.severity * 0.18, interactive: false }).addTo(condLayer)
      L.marker([z.lat, z.lon], { icon: L.divIcon({ className: '', html: `<span class="badge">❄ ${esc(z.label)}</span>`, iconSize: null }) }).addTo(condLayer)
    }
    for (const e of cond.road_events || []) {
      const color = e.kind === 'closure' ? '#b3261e' : e.kind === 'construction' ? '#d9822b' : '#9a5b00'
      L.circleMarker([e.lat, e.lon], { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(`<b>${esc(humanize(e.kind))}</b><br>${esc(e.label)}${e.delay_minutes ? `<br>+${e.delay_minutes} min delay` : ''}`)
        .addTo(condLayer)
    }
    document.getElementById('cond-chip')?.remove()
    const live = /open-meteo|feed/.test(`${cond.source.weather} ${cond.source.roads}`)
    $('status-chips').insertAdjacentHTML('beforeend', `<span class="chip ${cond.weather.length ? 'warn' : 'good'}" id="cond-chip">${esc(cond.summary)}${live ? ' · live' : ''}</span>`)
  }

  async function init() {
    try {
      state.world = await getJSON(`/world?patient_id=${encodeURIComponent(PATIENT_ID)}`)
    } catch (e) {
      $('patient-title').innerHTML = `<span class="error">Could not load map data</span>`
      $('patient-sub').textContent = String(e.message || e)
      return
    }
    renderHeader(state.world)
    renderProviders(state.world)
    drawWorld(state.world)
    if (params.get('scenario')) $('scenario').value = params.get('scenario')
    if (params.get('pregnant') === '1') $('pregnant').checked = true
    $('pregnant').addEventListener('change', () => {
      const url = new URL(location.href)
      if ($('pregnant').checked) url.searchParams.set('pregnant', '1')
      else url.searchParams.delete('pregnant')
      history.replaceState(null, '', url)
      if (state.selected) loadRoutes(state.selected)
    })
    $('scenario').addEventListener('change', () => {
      const url = new URL(location.href)
      url.searchParams.set('scenario', $('scenario').value)
      history.replaceState(null, '', url)
      if (state.selected) loadRoutes(state.selected)
    })
    const initial = params.get('provider_id')
    if (initial) selectProvider(initial)
  }

  // ---------- population analytics layer ----------
  const gapLayer = L.layerGroup()
  async function toggleGaps(on) {
    if (!on) {
      map.removeLayer(gapLayer)
      $('gap-summary').hidden = true
      return
    }
    if (!state.analytics) {
      try {
        state.analytics = await getJSON('/analytics/access')
      } catch (e) {
        $('gap-summary').hidden = false
        $('gap-summary').innerHTML = `<span class="error">Analytics unavailable: ${esc(e.message || e)}</span>`
        return
      }
      for (const r of state.analytics.by_region) {
        const color = r.care_gap ? css('--risk') : r.pct_over_30_mi >= 50 ? css('--warn') : css('--good')
        L.circle([r.lat, r.lon], { radius: 3000 + Math.sqrt(r.referrals) * 1800, color, weight: 1.5, fillColor: color, fillOpacity: 0.22 })
          .bindTooltip(`<b>${esc(r.region)}</b> (${esc(r.region_type)})${r.care_gap ? ' · <b>care gap</b>' : ''}<br>
            ${r.referrals} referrals · nearest specialist ~${r.avg_distance_to_nearest_specialist_mi} mi<br>
            ${r.pct_over_30_mi}% referred &gt;30 mi · avg wait ${r.avg_wait_days} d<br>
            ${r.pct_stalled}% stalled · telehealth ${r.telehealth_share_pct}%${r.public_transit_available ? '' : ' · no transit'}`)
          .addTo(gapLayer)
      }
    }
    const s = state.analytics.summary
    $('gap-summary').hidden = false
    $('gap-summary').textContent = `${state.analytics.cohort.referrals} referrals · ${s.patients_over_30_mi.original_referral} referred >30 mi (${s.patients_over_30_mi.after_hera} after HERA rerouting) · ${state.analytics.geographic_care_gaps.length} regional care gaps · avg wait ${s.wait_time_barriers.avg_wait_days_original} → ${s.wait_time_barriers.avg_wait_days_after_hera} days`
    gapLayer.addTo(map)
    map.fitBounds(L.latLngBounds(state.analytics.by_region.map((r) => [r.lat, r.lon])), { padding: [40, 40] })
  }
  $('gaps-toggle').addEventListener('change', (e) => toggleGaps(e.target.checked))

  window.HERA = { state, map, layers, getJSON, esc, humanize, css, selectProvider, JOURNEY_ID, PATIENT_ID }
  init()
})()
