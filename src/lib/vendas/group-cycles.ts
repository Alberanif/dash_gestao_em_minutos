import type { VendasFolderRecord } from "@/types/vendas";
import type { CycleWithProducts } from "@/components/vendas/types";

export interface CycleGroup {
  id: string; // folder.id or "unfoldered"
  name: string;
  isUnfolder: boolean;
  folder?: VendasFolderRecord;
  cycles: CycleWithProducts[];
  isExpanded: boolean;
}

/**
 * Módulo puro de agrupamento por pasta (PRD issue #169, task #173).
 * Recebe ciclos, pastas da conta e o id do ciclo selecionado.
 * Retorna os grupos ordenados (pastas A-Z, "Sem pasta" por último; ciclos por created_at desc)
 * e com o estado de expansão calculado (apenas a seção que contém o ciclo selecionado começa expandida).
 */
export function groupCyclesByFolder(
  cycles: CycleWithProducts[] = [],
  folders: VendasFolderRecord[] = [],
  selectedCycleId: string | null = null
): CycleGroup[] {
  // Map folderId -> cycles
  const folderMap = new Map<string, CycleWithProducts[]>();
  const unfolderedCycles: CycleWithProducts[] = [];

  // Index valid folder IDs
  const validFolderIds = new Set(folders.map((f) => f.id));

  // Ordena a lista completa de ciclos por created_at desc primeiro
  const sortedCycles = [...cycles].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return db - da;
  });

  for (const cycle of sortedCycles) {
    if (cycle.folder_id && validFolderIds.has(cycle.folder_id)) {
      const list = folderMap.get(cycle.folder_id) ?? [];
      list.push(cycle);
      folderMap.set(cycle.folder_id, list);
    } else {
      unfolderedCycles.push(cycle);
    }
  }

  // Ordena pastas da conta alfabeticamente (A-Z)
  const sortedFolders = [...folders].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const groups: CycleGroup[] = sortedFolders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    isUnfolder: false,
    folder,
    cycles: folderMap.get(folder.id) ?? [],
    isExpanded: false,
  }));

  // Grupo "Sem pasta"
  const unfolderedGroup: CycleGroup = {
    id: "unfoldered",
    name: "Sem pasta",
    isUnfolder: true,
    cycles: unfolderedCycles,
    isExpanded: false,
  };

  // Se houver ciclos sem pasta OU se não houver pastas nenhumas criadas
  if (unfolderedCycles.length > 0 || groups.length === 0) {
    groups.push(unfolderedGroup);
  }

  // Determinar qual grupo contém o ciclo selecionado
  let expandedGroupId: string | null = null;

  if (selectedCycleId) {
    for (const group of groups) {
      if (group.cycles.some((c) => c.id === selectedCycleId)) {
        expandedGroupId = group.id;
        break;
      }
    }
  }

  // Se nenhum grupo continha o ciclo selecionado (ou selectedCycleId é null), expande o primeiro grupo não vazio
  if (!expandedGroupId) {
    const firstNonEmpty = groups.find((g) => g.cycles.length > 0);
    if (firstNonEmpty) {
      expandedGroupId = firstNonEmpty.id;
    } else if (groups.length > 0) {
      expandedGroupId = groups[0].id;
    }
  }

  // Aplica o estado isExpanded
  return groups.map((g) => ({
    ...g,
    isExpanded: g.id === expandedGroupId,
  }));
}
