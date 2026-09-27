import { type FormEvent, useState } from 'react'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import type { AvailabilitySlot, CarePreferences } from '../types'
import { Icon } from './Icon'
import { EXPERTISE_OPTIONS, expertiseLabel, SLOT_LABEL } from '../lib/preferences'

const PLANS = ['MidwestCare PPO', 'MidwestCare HMO', 'BadgerCare Medicaid', 'Uninsured / self-pay']
const BUDGETS = [50, 100, 150, 250, 400]
const DISTANCES = [5, 10, 30, 60, 100]
const RATINGS = [3.5, 4, 4.5]
const TELEHEALTH: Record<CarePreferences['telehealth'], string> = { no_preference: 'No preference', prefer_telehealth: 'Prefer telehealth', in_person_only: 'In person only' }
const GENDER: Record<CarePreferences['provider_gender'], string> = { no_preference: 'No preference', female: 'Female', male: 'Male', nonbinary: 'Nonbinary' }

/** What matters to the patient when choosing a provider. Saving re-ranks provider options. */
export function PreferencesPanel({ planOnFile, home }: { planOnFile: string; home: string }) {
  const prefs = useApi(() => api.getPreferences(DEMO_PATIENT_ID), 'preferences')
  const [editing, setEditing] = useState(false)
  if (!prefs.data) return null
  const p = prefs.data

  const summary = [
    { icon: 'pill' as const, label: 'Cost', value: `${p.max_cost_usd != null ? `Up to $${p.max_cost_usd} per visit` : 'No budget limit'}${p.needs_financial_assistance ? ' · needs financial assistance' : ''}` },
    { icon: 'shield' as const, label: 'Insurance', value: p.insurance_plan ?? planOnFile },
    { icon: 'access' as const, label: 'Location', value: p.max_distance_mi != null ? `Within ${p.max_distance_mi} mi of ${home}` : `Any distance from ${home}` },
    { icon: 'stethoscope' as const, label: 'Expertise', value: `${p.expertise.length ? p.expertise.map(expertiseLabel).join(', ') : 'Any'}${p.min_rating != null ? ` · rated ${p.min_rating}+` : ''}` },
    { icon: 'calendar' as const, label: 'Schedule', value: p.availability.length ? p.availability.map((s) => SLOT_LABEL[s]).join(', ') : 'Any time' },
    { icon: 'video' as const, label: 'Telehealth', value: TELEHEALTH[p.telehealth] },
    { icon: 'user' as const, label: 'Clinician', value: p.provider_gender === 'no_preference' ? 'No gender preference' : `${GENDER[p.provider_gender]} clinician` },
    ...(p.pregnant ? [{ icon: 'check' as const, label: 'Pregnancy', value: 'Pregnant · clinicians and travel adjusted' }] : []),
  ]

  return (
    <section className="card" style={{ marginBottom: 20 }} aria-labelledby="prefs-h">
      <header className="card-header">
        <div>
          <h2 className="card-title" id="prefs-h"><Icon name="user" size={16} /> Your care preferences</h2>
          <div className="card-sub">HERA ranks providers using what matters to you</div>
        </div>
        {!editing && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit preferences</button>}
      </header>
      {editing ? (
        <PreferencesForm initial={p} planOnFile={planOnFile} onDone={() => setEditing(false)} />
      ) : (
        <dl className="pref-summary card-body">
          {summary.map((s) => (
            <div key={s.label} className="pref-item">
              <dt><Icon name={s.icon} size={14} /> {s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function PreferencesForm({ initial, planOnFile, onDone }: { initial: CarePreferences; planOnFile: string; onDone: () => void }) {
  const [f, setF] = useState<CarePreferences>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof CarePreferences>(k: K, v: CarePreferences[K]) => setF((x) => ({ ...x, [k]: v }))
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const num = (v: string) => (v === '' ? null : Number(v))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.savePreferences(DEMO_PATIENT_ID, f)
      onDone()
    } catch {
      setError('Could not save your preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card-body stack" onSubmit={submit} aria-label="Care preferences">
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Most you can pay per visit</span>
          <select className="select" value={f.max_cost_usd ?? ''} onChange={(e) => set('max_cost_usd', num(e.target.value))}>
            <option value="">No limit</option>
            {BUDGETS.map((b) => <option key={b} value={b}>${b}</option>)}
          </select>
          <label className="choice" style={{ alignSelf: 'flex-start' }}>
            <input type="checkbox" checked={f.needs_financial_assistance} onChange={(e) => set('needs_financial_assistance', e.target.checked)} />
            I need financial assistance or sliding-scale fees
          </label>
        </label>
        <label className="field">
          <span className="field-label">Insurance</span>
          <select className="select" value={f.insurance_plan ?? ''} onChange={(e) => set('insurance_plan', e.target.value || null)}>
            <option value="">Plan on file ({planOnFile})</option>
            {PLANS.filter((x) => x !== planOnFile).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">How far can you travel?</span>
          <select className="select" value={f.max_distance_mi ?? ''} onChange={(e) => set('max_distance_mi', num(e.target.value))}>
            <option value="">Any distance</option>
            {DISTANCES.map((d) => <option key={d} value={d}>Within {d} mi</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Minimum patient rating</span>
          <select className="select" value={f.min_rating ?? ''} onChange={(e) => set('min_rating', num(e.target.value))}>
            <option value="">Any rating</option>
            {RATINGS.map((r) => <option key={r} value={r}>{r}+ stars</option>)}
          </select>
        </label>
        <fieldset className="field field-wide">
          <legend className="field-label">Expertise you're looking for</legend>
          <div className="choice-row">
            {EXPERTISE_OPTIONS.map((x) => (
              <label key={x.value} className="choice">
                <input type="checkbox" checked={f.expertise.includes(x.value)} onChange={() => set('expertise', toggle(f.expertise, x.value))} />
                {x.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field field-wide">
          <legend className="field-label">When you're free for appointments</legend>
          <div className="choice-row">
            {(Object.keys(SLOT_LABEL) as AvailabilitySlot[]).map((s) => (
              <label key={s} className="choice">
                <input type="checkbox" checked={f.availability.includes(s)} onChange={() => set('availability', toggle(f.availability, s))} />
                {SLOT_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field field-wide">
          <span className="field-label">Pregnancy</span>
          <span className="choice" style={{ alignSelf: 'flex-start' }}>
            <input type="checkbox" checked={f.pregnant} onChange={(e) => set('pregnant', e.target.checked)} />
            I'm pregnant: favor clinicians experienced with pregnancy and plan travel for it
          </span>
        </label>
        <fieldset className="field">
          <legend className="field-label">Telehealth</legend>
          <div className="choice-row">
            {(Object.keys(TELEHEALTH) as CarePreferences['telehealth'][]).map((t) => (
              <label key={t} className="choice">
                <input type="radio" name="telehealth" checked={f.telehealth === t} onChange={() => set('telehealth', t)} />
                {TELEHEALTH[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend className="field-label">Clinician gender</legend>
          <div className="choice-row">
            {(Object.keys(GENDER) as CarePreferences['provider_gender'][]).map((g) => (
              <label key={g} className="choice">
                <input type="radio" name="provider_gender" checked={f.provider_gender === g} onChange={() => set('provider_gender', g)} />
                {GENDER[g]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save and re-rank'}</button>
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}
