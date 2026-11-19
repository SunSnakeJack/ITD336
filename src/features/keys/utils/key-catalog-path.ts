export function keyCatalogPath(special: boolean | undefined) {
  return special ? '/keys?tab=special' : '/keys'
}
