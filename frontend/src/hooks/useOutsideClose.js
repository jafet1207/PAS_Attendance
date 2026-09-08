import { useEffect } from 'react'

/** Llama a `close` cuando se hace clic/toque fuera de todos los elementos referenciados. */
export function useOutsideClose(refs, close) {
  useEffect(() => {
    function onPointerDown(event) {
      const insideAny = refs.some((ref) => ref.current && ref.current.contains(event.target))
      if (!insideAny) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [refs, close])
}
