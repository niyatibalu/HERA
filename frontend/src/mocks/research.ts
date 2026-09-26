// SYNTHETIC DATA — mirrors backend/app/data/studies.py and the StudyMatch shape in
// backend/app/models/research.py. Only studies Maya is potentially eligible for are returned.
import type { StudyMatch } from '../types'

export const mockStudyMatches: StudyMatch[] = [
  {
    study_id: 'study-a',
    candidate_id: 'cand-7f3a91',
    eligibility_status: 'potentially_eligible',
    criteria_satisfied: ['Age range 18–35', 'Pelvic pain documented for more than 6 months', 'Previous hormonal therapy'],
    criteria_unknown: [],
    reason: 'Your de-identified history meets the study’s published criteria for age range, symptom duration and treatment history.',
    title: 'Chronic Pelvic Pain Hormonal Therapy Outcomes Study',
    description:
      'Observational study following women with chronic pelvic pain who have tried hormonal therapy, to understand what predicts response.',
  },
]
