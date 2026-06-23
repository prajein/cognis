import { DomainEvent } from '../contracts/DomainEvent';

export interface EventBusContract {
  publish(event: DomainEvent<any>): void;
  subscribe(eventType: string, handler: Function): () => void;
  unsubscribe(handler: Function): void;
}

export class EventBus implements EventBusContract {
  // TODO: Implement EventBus
  publish(event: DomainEvent<any>): void {
    throw new Error('Not implemented');
  }

  subscribe(eventType: string, handler: Function): () => void {
    throw new Error('Not implemented');
  }

  unsubscribe(handler: Function): void {
    throw new Error('Not implemented');
  }
}
