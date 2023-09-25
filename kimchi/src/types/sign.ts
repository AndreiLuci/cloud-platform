export default interface SignResponse {
  resource: Resource;
  type: string;
  entity: Entity;
}

export interface Entity {
  purchaseId: string;
  purchaseState: string[];
}

export interface Resource {
  url: string;
  types: any[];
}
