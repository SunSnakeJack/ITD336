import { queryOptions } from '@tanstack/react-query'
import { getKeyCatalogDisplay } from './key-catalog-display.service'

export const keyCatalogDisplayQuery = () => queryOptions({
  queryKey: ['keys', 'catalog-display'] as const,
  queryFn: getKeyCatalogDisplay,
  retry: false,
})
