// SYNTHETIC DATA — fictional studies for the consent flow demo.
import type { StudyMatch } from '../types'

export const mockStudyMatches: StudyMatch[] = [
  {
    study_id: 'study-ppain',
    title: 'Pelvic Pain Research Study',
    sponsor: 'Upper Midwest Women’s Health Research Consortium',
    summary: 'An observational study following how chronic pelvic pain changes over time and how people respond to different treatments.',
    match_criteria: ['Age range 18–35', 'Pelvic pain for more than 6 months', 'Previous hormonal therapy', 'Symptoms continuing'],
    location: 'Duluth, MN',
    remote_option: true,
    time_commitment: 'Monthly 10-minute symptom survey for 12 months',
    contact_note: 'The study team will not see your name or contact details unless you choose to reach out to them.',
  },
  {
    study_id: 'study-iron',
    title: 'Iron Deficiency in Heavy Menstrual Bleeding',
    sponsor: 'Northland Regional Health Research Institute',
    summary: 'Comparing iron replacement approaches for people with heavy periods and low ferritin.',
    match_criteria: ['Heavy menstrual bleeding documented', 'Ferritin below 15 ng/mL', 'Oral iron already tried'],
    location: 'Virginia, MN',
    remote_option: false,
    time_commitment: '3 visits over 6 months',
    contact_note: 'The study team will not see your name or contact details unless you choose to reach out to them.',
  },
]
