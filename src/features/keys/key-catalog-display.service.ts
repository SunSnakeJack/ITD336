import { supabase } from '../../lib/supabase/client'

export type KeyCatalogDisplay = 'current' | 'key-tags' | 'current-no-history'

function readMode(data: unknown): KeyCatalogDisplay {
  if (data === 'current' || data === 'key-tags' || data === 'current-no-history') return data
  throw new Error('Invalid key catalog display setting')
}

export async function getKeyCatalogDisplay() {
  const { data, error } = await supabase.rpc('get_key_catalog_display' as never)
  if (error) throw new Error(error.message)
  return readMode(data)
}

export async function setKeyCatalogDisplay(mode: KeyCatalogDisplay) {
  const { data, error } = await supabase.rpc('set_key_catalog_display' as never, { p_mode: mode } as never)
  if (error) throw new Error(error.message)
  return readMode(data)
}
