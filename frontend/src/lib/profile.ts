// Farmer profile + app preferences, stored only in this browser (localStorage).
// Sent with every question so answers and eligibility use it.
import { useSyncExternalStore } from 'react'
import type { FarmerProfile } from './api'

export interface StoredProfile {
  name: string
  state: string
  district: string
  crop: string
  landAcres: string
  farmerType: string
  category: string
  irrigation: string
  webSearch: boolean
}

const KEY = 'krishimitra.profile.v2'
const ACRES_TO_HECTARES = 0.404686

export const EMPTY_PROFILE: StoredProfile = {
  name: '', state: '', district: '', crop: '', landAcres: '', farmerType: '', category: '', irrigation: '', webSearch: false,
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Puducherry', 'Chandigarh',
]

// Values the backend knows about (app/graph/graph_builder.py CROPS).
export const CROPS = [
  'rice', 'wheat', 'maize', 'millet', 'bajra', 'jowar', 'ragi', 'cotton', 'sugarcane', 'groundnut', 'soybean',
  'pulses', 'gram', 'mustard', 'oilseeds', 'tea', 'coffee', 'coconut', 'banana', 'mango', 'vegetables', 'fruits',
  'jute', 'barley', 'sunflower', 'turmeric', 'spices', 'onion', 'potato', 'tomato',
]

// Values the eligibility engine matches on (app/eligibility/matcher.py).
export const FARMER_TYPES = [
  { value: 'marginal', label: 'Marginal (under 1 ha / 2.5 acres)' },
  { value: 'small', label: 'Small (1–2 ha / 2.5–5 acres)' },
  { value: 'large', label: 'Large (over 2 ha / 5 acres)' },
  { value: 'tenant', label: 'Tenant / sharecropper' },
  { value: 'landless', label: 'Landless' },
  { value: 'women', label: 'Woman farmer' },
]

export const CATEGORIES = ['General', 'OBC', 'SC', 'ST']

let cache: StoredProfile | null = null
const listeners = new Set<() => void>()

function read(): StoredProfile {
  if (cache) return cache
  try {
    cache = { ...EMPTY_PROFILE, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    cache = { ...EMPTY_PROFILE }
  }
  return cache!
}

export function saveProfile(next: StoredProfile) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked (private mode): keep it for this session only */
  }
  listeners.forEach((l) => l())
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  saveProfile({ ...EMPTY_PROFILE })
}

export function useProfile(): StoredProfile {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
  )
}

export function toApiProfile(p: StoredProfile): FarmerProfile | null {
  const acres = parseFloat(p.landAcres)
  const profile: FarmerProfile = {
    state: p.state || null,
    district: p.district || null,
    crop: p.crop || null,
    land_size_hectares: Number.isFinite(acres) && acres > 0 ? +(acres * ACRES_TO_HECTARES).toFixed(3) : null,
    farmer_type: p.farmerType || null,
    category: p.category || null,
    irrigation: p.irrigation || null,
  }
  return Object.values(profile).some((v) => v != null) ? profile : null
}

export function profileCompleteness(p: StoredProfile): number {
  const fields = [p.state, p.crop, p.landAcres, p.farmerType]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}
