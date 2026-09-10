import { useState } from 'preact/hooks';

/** Déplace l'élément `fromId` à la place de `toId` (les autres glissent d'un cran). */
export function moveById<T extends { id: string }>(list: T[], fromId: string, toId: string): void {
  if (fromId === toId) return;
  const from = list.findIndex((x) => x.id === fromId);
  const to = list.findIndex((x) => x.id === toId);
  if (from === -1 || to === -1) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

/**
 * Glisser-déposer pour réordonner une liste de puces ou de lignes : l'élément saisi prend la
 * place de celui sur lequel on le lâche. `group` empêche de mélanger deux listes affichées ensemble.
 * Styles : `.drag-wrap`, `.dragging`, `.over`, `.drag-handle` (styles.css).
 */
export function useDragReorder(onMove: (fromId: string, toId: string, group: string) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGroup, setDragGroup] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const reset = () => { setDragId(null); setDragGroup(null); setOverId(null); };
  const props = (id: string, group = 'default') => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragId(id);
      setDragGroup(group);
      e.dataTransfer?.setData('text/plain', id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: DragEvent) => {
      if (dragId === null || dragGroup !== group) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      if (overId !== id) setOverId(id);
    },
    onDragLeave: () => { if (overId === id) setOverId(null); },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragId !== null && dragGroup === group && dragId !== id) onMove(dragId, id, group);
      reset();
    },
    onDragEnd: reset,
  });
  const cls = (id: string) => [dragId === id ? 'dragging' : '', overId === id && dragId !== id ? 'over' : ''].join(' ');
  return { props, cls };
}
