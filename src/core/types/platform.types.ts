/**
 * Platform Domain Types
 *
 * Defines the supported AI platforms that Cognis can integrate with.
 * Platform adapters implement the AIPlatformAdapter contract for each platform.
 *
 * Adding a new platform requires:
 * 1. Adding the platform identifier to this union.
 * 2. Creating a new adapter in src/platforms/.
 * 3. Registering the adapter in PlatformManager.
 *
 * No existing consumers need to change when a new platform is added.
 */

/**
 * Supported AI platform identifiers.
 * Used by PlatformManager and event source fields.
 */
export type AIPlatform = 'chatgpt' | 'claude' | 'gemini';
