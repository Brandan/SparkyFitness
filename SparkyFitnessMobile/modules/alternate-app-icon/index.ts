import { NativeModule, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Key of an alternate icon registered in Info.plist's
 * CFBundleIcons.CFBundleAlternateIcons. `null` means the primary icon,
 * which follows the system Light/Dark/Tinted setting on its own.
 */
export type AlternateAppIconName = 'Dark';

declare class AlternateAppIconModuleType extends NativeModule {
  isSupported(): boolean;
  currentIconName(): AlternateAppIconName | null;
  setIcon(name: AlternateAppIconName | null): Promise<boolean>;
}

function loadAlternateAppIcon(): AlternateAppIconModuleType | null {
  if (Platform.OS !== 'ios') return null;
  // Missing in a build from before this module, and in tests that have no
  // native runtime.
  try {
    return requireOptionalNativeModule<AlternateAppIconModuleType>(
      'AlternateAppIcon'
    );
  } catch {
    return null;
  }
}

const native = loadAlternateAppIcon();

/** False on Android, in a build from before this module, and on an iPad/iPhone that can't swap icons (rare, but the API allows it). */
export function isAlternateAppIconSupported(): boolean {
  return native?.isSupported() ?? false;
}

/** `null` means the primary (system-following) icon is active. */
export function getCurrentAppIconName(): AlternateAppIconName | null {
  if (!native) return null;
  try {
    return native.currentIconName();
  } catch {
    return null;
  }
}

/** Pass `null` to restore the primary icon. Resolves false if the OS refused the change. */
export function setAppIcon(
  name: AlternateAppIconName | null
): Promise<boolean> {
  if (!native) return Promise.resolve(false);
  return native.setIcon(name).catch(() => false);
}
