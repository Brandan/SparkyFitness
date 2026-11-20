import ExpoModulesCore
import UIKit

// `setAlternateIconName` is an app-chosen override that sits on top of
// whatever the Home Screen's own Light/Dark/Tinted appearance would
// otherwise show. There is no API for an app to choose *between* the
// Icon Composer's own light/dark/tinted renders of the primary icon; this
// is a second, independent icon the app opts into, named in Info.plist's
// CFBundleIcons.CFBundleAlternateIcons. `name: nil` restores the primary
// (system-following) icon.
public class AlternateAppIconModule: Module {
    public func definition() -> ModuleDefinition {
        Name("AlternateAppIcon")

        Function("isSupported") { () -> Bool in
            UIApplication.shared.supportsAlternateIcons
        }

        // nil means the primary (system-following) icon is active.
        Function("currentIconName") { () -> String? in
            UIApplication.shared.alternateIconName
        }

        AsyncFunction("setIcon") { (name: String?) -> Bool in
            guard UIApplication.shared.supportsAlternateIcons else { return false }
            return await setAlternateIcon(name)
        }
    }
}

@MainActor
private func setAlternateIcon(_ name: String?) async -> Bool {
    await withCheckedContinuation { continuation in
        UIApplication.shared.setAlternateIconName(name) { error in
            continuation.resume(returning: error == nil)
        }
    }
}
