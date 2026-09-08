import { useEffect, useMemo, useState } from 'react'

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 100]

/** Pagina un arreglo ya cargado/filtrado en memoria (paginación del lado del navegador). */
export function usePagination(items, initialPageSize = 5) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Si el filtro/búsqueda reduce la lista y la página actual queda fuera de rango, retrocede
  // a la última página válida en vez de mostrar una página vacía.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  function changePageSize(size) {
    setPageSize(size)
    setPage(1)
  }

  return { page, setPage, pageSize, setPageSize: changePageSize, pageItems, totalPages, totalItems }
}
