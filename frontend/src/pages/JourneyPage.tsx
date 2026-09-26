import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { DataSourceNote, Loading, PageHeader } from '../components/common'
import { CareJourney } from '../components/CareJourney'
import { Icon } from '../components/Icon'
import { RouteOptions } from '../components/RouteOptions'
import { currentStep, isComplete } from '../lib/journey'
import { providerLookup } from '../lib/record'
import { journeyProviderId } from '../lib/providers'
import { formatDate } from '../lib/format'
import { DEMO_TODAY } from '../mocks/record'
import type { CareJourney as CareJourneyData } from '../types'

export function JourneyPage() {
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const { hash } = useLocation()

  useEffect(() => {
    if (hash && journeys.data) document.getElementById(hash.slice(1))?.scrollIntoView?.({ behavior: 'smooth' })
  }, [hash, journeys.data])

  if (!journeys.data || !record.data) return <Loading label="Loading care journeys…" />

  const lookup = providerLookup(record.data.providers)
  const provider = (j: CareJourneyData) => lookup(journeyProviderId(j, record.data!.providers))
  const active = journeys.data.filter((j) => !isComplete(j))
  const complete = journeys.data.filter(isComplete)

  return (
    <>
      <PageHeader
        eyebrow="Care journey"
        title="Every referral, tracked to the finish"
        lede="HERA keeps following a care need after a referral is placed, through scheduling, travel, the visit and follow-up, and flags it when progress stops."
        actions={<DataSourceNote source={journeys.source} />}
      />

      <div className="stack">
        {active.map((j) => (
          <CareJourney
            key={j.journey_id}
            journey={j}
            provider={provider(j)}
            today={DEMO_TODAY}
            stalledAction={
              <Link className="btn btn-primary btn-sm" to={`/access?journey=${j.journey_id}&show=options`}>
                Find better options
              </Link>
            }
          >
            {currentStep(j)?.state === 'travel_planned' && !j.stalled && <TravelPlanner journey={j} />}
          </CareJourney>
        ))}
      </div>

      {complete.length > 0 && (
        <section className="section-gap stack">
          <h2 className="section-label">Completed pathways</h2>
          {complete.map((j) => (
            <CareJourney key={j.journey_id} journey={j} provider={provider(j)} today={DEMO_TODAY} />
          ))}
        </section>
      )}
    </>
  )
}

function TravelPlanner({ journey }: { journey: CareJourneyData }) {
  const routes = useApi(() => api.getRouteOptions(DEMO_PATIENT_ID, journey.journey_id), `routes:${journey.journey_id}`)
  const [selected, setSelected] = useState<string>()
  const [saving, setSaving] = useState(false)
  const opts = routes.data?.options ?? []
  const pick = opts.find((o) => o.route_id === selected)

  const confirm = async () => {
    if (!pick) return
    setSaving(true)
    await api.planTravel(DEMO_PATIENT_ID, journey.journey_id, pick.label)
    setSaving(false)
  }

  return (
    <div className="travel" id={`travel-${journey.journey_id}`}>
      <div className="travel-head">
        <div>
          <h3 className="card-title"><Icon name="access" size={16} /> Plan how to get there</h3>
          <p className="card-sub">
            {routes.data ? `${routes.data.destination} · ${formatDate(routes.data.appointment_date, { year: true })}` : 'Loading route options…'}
            {routes.source === 'demo' && ' · sample routes until the access map is connected'}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={!pick || saving} onClick={confirm}>
          {saving ? 'Saving…' : pick ? `Use ${pick.label.toLowerCase()}` : 'Choose an option'}
        </button>
      </div>
      {opts.length > 0 && <RouteOptions options={opts} selected={selected} onSelect={setSelected} />}
    </div>
  )
}
