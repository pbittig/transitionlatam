// Raw row shape from dataset/solicitudes_muestra.xlsx.
// Reference: /docs/04-modelo-datos.md §4.8

export interface RawSolicitudRow {
  id: number;
  proyecto: string;
  nup: string | null;
  empresaSolicitante: string;
  tipo: string | null;
  estadoSolicitud: string;
  fechaRecepcion: string | null;
  capacidadMw: number | null;
  tipoProyecto: string | null;
  tipoTecnologia: string | null;
  potenciaNetaInyeccionMw: number | null;
  potenciaNetaRetiroMw: number | null;
  potenciaGeneracionMw: number | null;
  potenciaAlmacenamientoMw: number | null;
  energiaMwh: number | null;
  horasAlmacenamiento: number | null;
  fechaEstimadaConexion: string | null;
  puntoConexion: string | null;
  nivelTension: string | null;
  barra: string | null;
  pano: string | null;
  region: string | null;
  comuna: string | null;
  segmentoTransmision: string | null;
}

export interface NormalizedProject {
  externalId: string;
  projectName: string;
  nup: string | null;
  companyName: string;
  requestType: string | null;
  statusLabel: string;
  technologyCode: string | null;
  includesStorage: boolean;
  projectKind: "generation" | "storage" | "consumption" | "transmission" | "hybrid" | null;
  capacityMw: number | null; // "titular", ver project.capacity_mw en 04-modelo-datos.md §4.8
  capacityMwh: number | null;
  netInjectionMw: number | null;
  netWithdrawalMw: number | null;
  generationCapacityMw: number | null;
  storageCapacityMw: number | null;
  storageHours: number | null;
  estimatedConnectionDate: string | null; // ISO date
  receivedAt: string | null; // ISO datetime
  connectionPoint: string | null;
  voltageLevel: string | null;
  substationBay: string | null;
  transmissionSegment: string | null;
  regionRaw: string | null;
  comuna: string | null;
}
