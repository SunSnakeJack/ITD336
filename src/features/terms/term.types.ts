export interface AcademicTerm {
  id: string
  academicYear: string
  termCode: string
  startsOn: string
  endsOn: string
  active: boolean
}

export interface AcademicTermInput extends Omit<AcademicTerm, 'id'> { id?: string }
