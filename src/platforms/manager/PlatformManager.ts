import { AIPlatformAdapter } from '../interfaces';

export class PlatformManager {
  // TODO: Manage active AI platform adapter
  constructor() {}
  
  getActiveAdapter(): AIPlatformAdapter | null {
    throw new Error('Not implemented');
  }
}
