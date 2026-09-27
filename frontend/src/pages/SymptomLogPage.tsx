import { type FormEvent, useState } from 'react'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Card, DataSourceNote, Loading, PageHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { COMMON_SYMPTOMS, groupByVisit, TIMING_LABEL, visitOptions } from '../lib/symptoms'
import { formatDate } from '../lib/format'
import type { NewSymptomLogEntry, SymptomLogEntry } from '../types'

export function SymptomLogPage() {
  const log = useApi(() => api.getSymptomLog(DEMO_PATIENT_ID), 'symptom-log')
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  if (!log.data || !record.data || !journeys.data) return <Loading label="Loading your health timeline…" />

  const visits = visitOptions(record.data, journeys.data)
  const groups = groupByVisit(log.data)
  const byVisit = new Map(groups.filter((g) => g.visit).map((g) => [g.visit!, g]))
  const general = groups.find((g) => !g.visit)
  const extra = groups.filter((g) => g.visit && !visits.includes(g.visit)).map((g) => g.visit!)
  const timeline = [...visits, ...extra]

  return (
    <>
      <PageHeader
        eyebrow="Health timeline"
        title="Your visits and notes"
        lede="Note how you feel before and after each visit. Your notes, kept for you."
        actions={<DataSourceNote source={log.source} />}
      />
      <div className="grid grid-main">
        <ol className="timeline" aria-label="Visits and notes">
          {timeline.map((v) => {
            const g = byVisit.get(v)
            const upcoming = v.endsWith('(upcoming)')
            return (
              <li key={v} className={`timeline-item ${upcoming ? 'is-upcoming' : ''} ${g ? '' : 'is-quiet'}`}>
                <span className="timeline-dot" aria-hidden="true" />
                <section className="timeline-body" aria-label={v}>
                  <h2 className="timeline-title">{v.replace(' (upcoming)', '')}{upcoming && <span className="badge badge-accent">Upcoming</span>}</h2>
                  {g ? (
                    <div className="stack-sm">
                      {[...g.before, ...g.after].map((e) => <SymptomNote key={e.entry_id} entry={e} />)}
                    </div>
                  ) : (
                    <p className="timeline-empty">No notes for this visit</p>
                  )}
                </section>
              </li>
            )
          })}
          {general && (
            <li className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <section className="timeline-body" aria-label="General notes">
                <h2 className="timeline-title">General notes</h2>
                <div className="stack-sm">{general.general.map((e) => <SymptomNote key={e.entry_id} entry={e} />)}</div>
              </section>
            </li>
          )}
        </ol>
        <div className="sticky-side">
          <NewSymptomForm visits={visits} />
        </div>
      </div>
    </>
  )
}

function SymptomNote({ entry: e }: { entry: SymptomLogEntry }) {
  const [busy, setBusy] = useState(false)
  return (
    <article className="symptom-note" aria-label={`${e.symptom}, ${e.severity} out of 10, ${TIMING_LABEL[e.timing].toLowerCase()}`}>
      <div className="symptom-note-head">
        <span className={`badge ${e.timing === 'before_visit' ? 'badge-info' : e.timing === 'after_visit' ? 'badge-accent' : ''}`}>{TIMING_LABEL[e.timing]}</span>
        <strong>{e.symptom}</strong>
        <span className={`severity num ${e.severity >= 7 ? 'is-high' : ''}`} title="Severity you rated, 0-10">{e.severity}/10</span>
        <span className="list-meta num">{formatDate(e.logged_on, { year: true })}</span>
        <button type="button" className="btn btn-ghost btn-sm symptom-delete" aria-label={`Delete note about ${e.symptom} from ${formatDate(e.logged_on)}`} disabled={busy}
          onClick={async () => { setBusy(true); await api.deleteSymptom(DEMO_PATIENT_ID, e.entry_id).finally(() => setBusy(false)) }}>
          <Icon name="x" size={14} />
        </button>
      </div>
      {e.note && <p className="symptom-note-text">{e.note}</p>}
    </article>
  )
}

const EMPTY: NewSymptomLogEntry = { symptom: '', severity: 5, timing: 'before_visit', visit: '', note: '' }

function NewSymptomForm({ visits }: { visits: string[] }) {
  const [form, setForm] = useState<NewSymptomLogEntry>({ ...EMPTY, visit: visits[0] ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof NewSymptomLogEntry>(k: K, v: NewSymptomLogEntry[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!form.symptom.trim()) return setError('Add a symptom first.')
    setSaving(true)
    setError(null)
    try {
      await api.addSymptom(DEMO_PATIENT_ID, form)
      setForm({ ...EMPTY, timing: form.timing, visit: form.visit })
    } catch {
      setError('Could not save your note. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card icon="flag" title="Log a symptom" sub="Saved to your HERA profile">
      <form className="card-body stack" onSubmit={submit} aria-label="Log a symptom">
        <label className="field">
          <span className="field-label">Symptom</span>
          <input className="input" list="symptom-suggestions" value={form.symptom} onChange={(e) => set('symptom', e.target.value)} placeholder="e.g. Pelvic pain" maxLength={80} />
          <datalist id="symptom-suggestions">{COMMON_SYMPTOMS.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="field">
          <span className="field-label">How bad is it? <span className="field-hint">0 = none, 10 = worst</span></span>
          <span className="range-row">
            <input type="range" min={0} max={10} step={1} value={form.severity} onChange={(e) => set('severity', Number(e.target.value))} aria-label="Severity" />
            <span className="range-value num">{form.severity}/10</span>
          </span>
        </label>
        <fieldset className="field">
          <legend className="field-label">When</legend>
          <div className="choice-row">
            {(['before_visit', 'after_visit', 'general'] as const).map((t) => (
              <label key={t} className="choice">
                <input type="radio" name="timing" checked={form.timing === t} onChange={() => set('timing', t)} />
                {t === 'general' ? 'Just a note' : TIMING_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        {form.timing !== 'general' && (
          <label className="field">
            <span className="field-label">Which visit</span>
            <select className="select" value={form.visit ?? ''} onChange={(e) => set('visit', e.target.value)}>
              {visits.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
        <label className="field">
          <span className="field-label">Note</span>
          <textarea className="textarea" value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={2000}
            placeholder={form.timing === 'before_visit' ? 'What do you want to tell or ask your clinician?' : form.timing === 'after_visit' ? 'What changed? What did they recommend?' : 'Anything you want to remember'} />
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button></div>
      </form>
    </Card>
  )
}
