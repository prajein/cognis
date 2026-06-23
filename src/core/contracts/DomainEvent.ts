export interface DomainEvent<T> {
  id: string;
  type: string;
  timestamp: number;
  sessionId: string;
  source: string;
  payload: T;
}
