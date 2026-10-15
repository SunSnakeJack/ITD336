import { queryOptions } from '@tanstack/react-query'
import { getAcademicTerms } from './term.service'

export const termKeys = { all: ['academic-terms'] as const }
export const academicTermsQuery = () => queryOptions({ queryKey: termKeys.all, queryFn: getAcademicTerms })
