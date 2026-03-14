import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchResources } from '../api/lemontree'
import { computeRiskScore } from '../utils/mlScoring'

export function useResources(apiParams = {}) {
  const [progress, setProgress] = useState(0)

  const { data: raw = [], isLoading, error } = useQuery({
    queryKey: ['resources', JSON.stringify(apiParams)],
    queryFn: async () => {
      let cursor
      let all = []
      let total = null
      do {
        const data = await fetchResources({ take: 100, ...apiParams, ...(cursor ? { cursor } : {}) })
        const resources = data.resources ?? []
        if (total === null) total = data.count ?? 0
        all = [...all, ...resources]
        setProgress(Math.round((all.length / Math.max(total, 1)) * 100))
        cursor = data.cursor
        if (all.length >= Math.min(total, 500)) break
      } while (cursor)
      return all
    },
    staleTime: 1000 * 60 * 10,
    retry: 2,
  })

  const enriched = useMemo(
    () => raw
      .filter(r => !r.mergedToResourceId)
      .map(r => ({ ...r, riskScore: computeRiskScore(r) })),
    [raw]
  )

  return { data: enriched, isLoading, error, progress }
}

export function useFilteredResources(filters = {}) {
  // Pass search-friendly params to API; do fine-grained filtering client-side
  const apiParams = useMemo(() => {
    const p = {}
    if (filters.zipCode?.trim()) p.location = filters.zipCode.trim()
    if (filters.text?.trim()) p.text = filters.text.trim()
    if (filters.resourceType && filters.resourceType !== 'all') p.resourceTypeId = filters.resourceType
    p.sort = filters.sort ?? 'reviews'
    return p
  }, [filters.zipCode, filters.text, filters.resourceType, filters.sort])

  const { data, isLoading, error, progress } = useResources(apiParams)

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (filters.minRating && (r.ratingAverage ?? 0) < parseFloat(filters.minRating)) return false
      if (filters.openByAppointment === 'appointment' && !r.openByAppointment) return false
      if (filters.openByAppointment === 'walkin' && r.openByAppointment) return false
      return true
    })
  }, [data, filters])

  return { data: filtered, all: data, isLoading, error, progress }
}
