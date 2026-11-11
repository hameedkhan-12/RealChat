export type FlowStep =
  | 'welcome'
  | 'intent'
  | 'space_type'
  | 'investment_range'
  | 'project_interest'
  | 'project_selection'
  | 'name'
  | 'email'
  | 'slot_booking'
  | 'meeting_booked'
  | 'live_agent'

export interface RealEstateFlowConfig {
  intentOptions: string[]
  spaceTypes: string[]
  investmentRanges: string[]
  projectInterestOptions: string[]
  defaultProjects: string[]
  meetingDuration: string
  defaultTimezone: string
}

export const REAL_ESTATE_CONFIG: RealEstateFlowConfig = {
  intentOptions: [
    'Interested in Owning',
    'Interested in Leasing',
    'Talk to an Agent',
  ],
  spaceTypes: [
    '1 Bedroom',
    '2 Bedroom',
    '3 Bedroom',
    'Penthouse',
    'Villa / Mansion',
    'Commercial / Office',
  ],
  investmentRanges: [
    'No Preference',
    'AED 5 – 15 Million',
    'AED 16 – 25 Million',
    'Above AED 25 Million',
  ],
  projectInterestOptions: ['Yes', 'Explore All Projects'],
  defaultProjects: [
    'Alba Residences',
    'Opus Residences',
    'The Lana Residences',
    'ORLA',
    'VELA',
    'VELA Viento',
  ],
  meetingDuration: '15 min',
  defaultTimezone: 'GMT +05:00',
}

