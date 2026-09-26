// HERA care access map. Plain JS + vendored Leaflet so it runs with no build step and no internet.
// URL params: ?patient_id=maya-001&provider_id=prov-alt-best&api=http://127.0.0.1:8001
;(function () {
  'use strict'

  const params = new URLSearchParams(location.search)
  const API = (params.get('api') || '').replace(/\/$/, '')
  const PATIENT_ID = params.get('patient_id') || 'maya-001'
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
      const color = f.kind === 'hospital_er' ? css('--hospital') : css('--urgent')
      L.marker([f.lat, f.lon], { icon: dotIcon(color, 10), title: f.name })
        .bindTooltip(`<b>${esc(f.name)}</b><br>${esc(humanize(f.kind === 'hospital_er' ? 'hospital / emergency' : f.kind))}`)
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
    const chips = [`<span class="chip ${world.data_source === 'live' ? 'good' : 'warn'}">${world.data_source === 'live' ? 'Live backend data' : 'Demo data (synthetic)'}</span>`]
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
    state.providerMarkers[providerId]?.openTooltip()
    const url = new URL(location.href)
    url.searchParams.set('provider_id', providerId)
    history.replaceState(null, '', url)
    if (window.HERA_onProviderSelected) window.HERA_onProviderSelected(pr)
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
    const initial = params.get('provider_id')
    if (initial) selectProvider(initial)
  }

  window.HERA = { state, map, layers, getJSON, esc, humanize, css, selectProvider, JOURNEY_ID, PATIENT_ID }
  init()
})()
