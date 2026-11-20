# iOS Firebase configuration

Before building Runner with Flutter or Xcode, download `GoogleService-Info.plist` from a Firebase project you control, for the iOS app whose bundle identifier matches your Runner target. Place it at `ios/Runner/GoogleService-Info.plist` (relative to the repository root). Check its format on macOS with:

```sh
plutil -lint ios/Runner/GoogleService-Info.plist
```

Xcode still copies this file into the Runner bundle. A clean checkout does not include it; if you set up iOS CI, provision the file from your CI secret store before the build. Do not commit it or reuse the upstream project's configuration. Treat bundled client API keys as readable: restrict the key to the appropriate iOS app and only the Google APIs it needs, and protect backend data with Firebase Security Rules.

Android and Windows builds do not use this file.
