/// <reference types="chrome" />
import { EventBusContract } from './types';
import { EventType } from './registry';
import { DomainEvent } from './contracts';

/** Identifies the browser extension process context. */
export type ExtensionContext = 'content-script' | 'background' | 'side-panel';

/** The envelope used to wrap DomainEvents over Chrome IPC. */
export interface BridgeEnvelope {
  originContext: ExtensionContext;
  event: DomainEvent<any>;
}

/**
 * Extension Event Bridge
 *
 * Coordinates the routing of events across isolated browser extension contexts
 * (Content Script <-> Background Service Worker <-> Side Panel).
 *
 * Implements the architecture defined in the EventBus Implementation Plan, ensuring
 * that the core EventBus remains free of platform-specific IPC logic.
 */
export class ExtensionEventBridge {
  private readonly localContext: ExtensionContext;
  private readonly localBus: EventBusContract;
  private readonly subscribedEventTypes: EventType[];
  
  // To prevent infinite forwarding loops and echoing, we track recently bridged event IDs.
  private readonly recentlyBridgedIds = new Set<string>();
  private readonly MAX_TRACKED_IDS = 1000;

  // For persistent connections (Side Panel -> Background)
  private port: chrome.runtime.Port | null = null;
  private connectedPorts = new Set<chrome.runtime.Port>();

  constructor(
    localContext: ExtensionContext,
    localBus: EventBusContract,
    eventsToBridge: EventType[]
  ) {
    this.localContext = localContext;
    this.localBus = localBus;
    this.subscribedEventTypes = eventsToBridge;
  }

  /**
   * Initializes the bridge, setting up local subscriptions and IPC listeners.
   */
  public initialize(): void {
    // 1. Subscribe to local bus to bridge events OUT
    for (const type of this.subscribedEventTypes) {
      this.localBus.subscribe(type, (event) => this.bridgeOut(event));
    }

    // 2. Listen for events coming IN from other contexts
    if (this.localContext === 'content-script') {
      chrome.runtime.onMessage.addListener(this.handleIncomingMessage.bind(this));
    } else if (this.localContext === 'background') {
      chrome.runtime.onMessage.addListener(this.handleIncomingMessage.bind(this));
      
      // Accept persistent port connections from Side Panels
      chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'cognis-event-bridge') {
          this.connectedPorts.add(port);
          port.onMessage.addListener(this.handleIncomingMessage.bind(this));
          port.onDisconnect.addListener(() => {
            this.connectedPorts.delete(port);
          });
        }
      });
    } else if (this.localContext === 'side-panel') {
      this.connectPort();
    }
  }

  /**
   * Forwards a locally published event to other extension contexts.
   */
  private bridgeOut(event: DomainEvent<any>): void {
    // Loop prevention: If we already bridged this event, do not echo it out again.
    if (this.recentlyBridgedIds.has(event.id)) {
      return;
    }
    
    this.trackEventId(event.id);

    const outboundEvent: DomainEvent<any> = {
      ...event,
      origin: event.origin ?? 'local',
    };

    const envelope: BridgeEnvelope = {
      originContext: this.localContext,
      event: outboundEvent,
    };

    console.log(`\n[Bridge] OUT → ${this.localContext === 'background' ? 'clients' : 'background'}\nevent=${event.type}\neventId=${event.id}\nsessionId=${event.sessionId || 'N/A'}\nsource=${this.localContext}\n`);

    try {
      if (this.localContext === 'content-script') {
        chrome.runtime.sendMessage(envelope).catch(() => {});
      } else if (this.localContext === 'side-panel') {
        if (!this.port) {
          console.warn(`[ExtensionEventBridge] Port is null. Attempting to reconnect...`);
          this.connectPort();
        }
        if (this.port) {
          console.log(`[ExtensionEventBridge] Bridging OUT event ${event.type} to Background via port`, event.id);
          this.port.postMessage(envelope);
        } else {
          console.warn(`[ExtensionEventBridge] Cannot bridge OUT event ${event.type}. Port is STILL null!`);
        }
      } else if (this.localContext === 'background') {
        // Broadcast to all Side Panels
        for (const port of this.connectedPorts) {
          port.postMessage(envelope);
        }
        // Broadcast to all active Content Scripts (Tabs)
        chrome.tabs.query({}, (tabs) => {
          for (const tab of tabs) {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, envelope).catch(() => {});
            }
          }
        });
      }
    } catch (error) {
      console.warn(`[ExtensionEventBridge] Failed to bridge event ${event.type}:`, error);
    }
  }

  /**
   * Receives an event from IPC and publishes it locally.
   */
  private handleIncomingMessage(message: any, senderOrPort?: chrome.runtime.MessageSender | chrome.runtime.Port): void {
    if (!message || !message.originContext || !message.event) {
      return;
    }

    let senderTabId: number | undefined;
    if (senderOrPort && 'tab' in senderOrPort && senderOrPort.tab?.id) {
      senderTabId = senderOrPort.tab.id;
    }

    const envelope = message as BridgeEnvelope;

    // Loop prevention: Do not accept events that originated from our own context type.
    if (envelope.originContext === this.localContext) return;

    // We drop events this context originated and already processed locally.
    // The ONLY exception is session lifecycle events (session.started, session.ended, etc.)
    // where the originating client (side-panel or content-script) awaits the authoritative
    // confirmation from the background orchestrator.
    if (this.recentlyBridgedIds.has(envelope.event.id)) {
      if (!envelope.event.type.startsWith('session.')) {
        return;
      }
    }

    console.log(`\n[Bridge] IN ← ${envelope.originContext}\nevent=${envelope.event.type}\neventId=${envelope.event.id}\nsessionId=${envelope.event.sessionId || 'N/A'}\n`);
    this.trackEventId(envelope.event.id);

    // Stamp inbound event with transport metadata indicating it arrived from a remote context
    const inboundEvent: DomainEvent<any> = {
      ...envelope.event,
      origin: 'remote',
      isAuthoritative: true,
    };

    // Publish to local EventBus
    this.localBus.publish(inboundEvent.type, inboundEvent);

    // If we are in the background worker and an event arrives from content-script or side-panel,
    // broadcast the authoritative event to all connected sidepanels and other tabs.
    if (this.localContext === 'background') {
      const broadcastEnvelope: BridgeEnvelope = {
        originContext: 'background',
        event: inboundEvent,
      };
      for (const port of this.connectedPorts) {
        port.postMessage(broadcastEnvelope);
      }
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          // Do NOT echo the event back to the exact tab that originated it!
          if (tab.id && (!senderTabId || tab.id !== senderTabId)) {
            chrome.tabs.sendMessage(tab.id, broadcastEnvelope).catch(() => {});
          }
        }
      });
    }
  }

  private connectPort(): void {
    this.port = chrome.runtime.connect({ name: 'cognis-event-bridge' });
    this.port.onMessage.addListener(this.handleIncomingMessage.bind(this));
    this.port.onDisconnect.addListener(() => {
      this.port = null;
      // Reconnect logic could be added here
    });
  }

  private trackEventId(id: string): void {
    this.recentlyBridgedIds.add(id);
    if (this.recentlyBridgedIds.size > this.MAX_TRACKED_IDS) {
      // FIFO eviction: Javascript Sets iterate in insertion order.
      // Deleting the first key evicts the oldest element.
      const oldestId = this.recentlyBridgedIds.keys().next().value;
      if (oldestId !== undefined) {
        this.recentlyBridgedIds.delete(oldestId);
      }
    }
  }
}
