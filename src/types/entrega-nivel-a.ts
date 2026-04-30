export type {
  EntregaNivelAMccFccProjetoRow,
  EntregaNivelAFccMccMensalRow,
  EntregaNivelAUltimateMensalRow,
  EntregaNivelAUltimateProjetoRow,
  EntregaNivelADestraveProjetoRow,
} from "./base-de-dados";

export type EntregaNivelASection =
  | "mcc-fcc-projeto"
  | "fcc-mcc-mensal"
  | "ultimate-mensal"
  | "ultimate-projeto"
  | "destrave-projeto";
