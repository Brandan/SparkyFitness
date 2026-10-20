#!/bin/bash
# Xcode Cloud post-clone step: install JS and pod dependencies, point Xcode's
# script phases at node, and give every target this run's build number.
# ios/ci_scripts/ci_post_clone.sh calls this (Xcode Cloud only looks next to
# the workspace). Also runnable by hand to prepare a fresh checkout.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$(cd "$HERE/.." && pwd)"
REPO="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$MOBILE/.." && pwd)}"
BUILD_NUMBER="${CI_BUILD_NUMBER:-1}"

# shellcheck source=fork.env.sh
. "$HERE/fork.env.sh"

command -v node >/dev/null || brew install node
command -v pod >/dev/null || brew install cocoapods

cd "$REPO"
npx -y pnpm@10.33.4 install --frozen-lockfile --filter sparkyfitnessmobile...

cd "$MOBILE/ios"
# The "Bundle React Native code" phase sources this; it needs node and the
# same variables the app config read when ios/ was generated.
cat > .xcode.env.local <<ENV
export NODE_BINARY=$(command -v node)
export APP_VARIANT=$APP_VARIANT
export EXPO_DEV_BUNDLE_IDENTIFIER=$EXPO_DEV_BUNDLE_IDENTIFIER
export IOS_APP_GROUP_DEV=$IOS_APP_GROUP_DEV
export EXPO_DEV_APPLE_TEAM_ID=$EXPO_DEV_APPLE_TEAM_ID
ENV

pod install

# App Store Connect needs a higher build number on every upload. Targets that
# generate their Info.plist read CURRENT_PROJECT_VERSION; the app and the
# widgets extension carry a literal CFBundleVersion.
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/" \
  SparkyFitness.xcodeproj/project.pbxproj
for plist in SparkyFitness/Info.plist ExpoWidgetsTarget/Info.plist; do
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "$plist"
done
echo "Prepared build $BUILD_NUMBER"
