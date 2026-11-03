export interface Coordinates {
  latitude: number
  longitude: number
}

export interface City {
  id?: string
  name: string
  region?: string
  country: 'United States'
}

export interface CitySuggestion {
  id: string
  name: string
  region?: string
  label: string
}
