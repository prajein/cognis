import { PlatformConfig } from './interfaces';
import { chatgptV1 } from './chatgpt-v1';

const configs: PlatformConfig[] = [
  chatgptV1,
  // Add future platforms (claude, etc.) here
];

export class SelectorRegistry {
  /**
   * Resolves the appropriate DOM selector configuration based on the current window URL.
   */
  static resolve(url: string): PlatformConfig | null {
    for (const config of configs) {
      if (config.urlPattern.test(url)) {
        return config;
      }
    }
    return null;
  }
}
