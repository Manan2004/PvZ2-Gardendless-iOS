import UIKit
import WebKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        unlockHighRefreshRate(preferences: config.preferences)
        return config
    }

    private func unlockHighRefreshRate(preferences: WKPreferences) {
        // Unlock 120Hz ProMotion on WebKit:
        // 1. Inspect private WebKit _features for PreferPageRenderingUpdatesNear60FPSEnabled
        let wkPrefsClass: AnyObject = WKPreferences.self
        let selFeatures = Selector(("_features"))
        if wkPrefsClass.responds(to: selFeatures),
           let features = wkPrefsClass.perform(selFeatures)?.takeUnretainedValue() as? [NSObject] {
            for feature in features {
                let selKey = Selector(("key"))
                if feature.responds(to: selKey),
                   let key = feature.perform(selKey)?.takeUnretainedValue() as? String,
                   key == "PreferPageRenderingUpdatesNear60FPSEnabled" {
                    let selector = Selector(("_setEnabled:forFeature:"))
                    if preferences.responds(to: selector) {
                        typealias SetEnabledFunc = @convention(c) (AnyObject, Selector, Bool, AnyObject) -> Void
                        let imp = preferences.method(for: selector)
                        let callSetting = unsafeBitCast(imp, to: SetEnabledFunc.self)
                        callSetting(preferences, selector, false, feature)
                        print("[ProMotion] Successfully disabled PreferPageRenderingUpdatesNear60FPSEnabled")
                    }
                }
            }
        }

        // 2. Direct private setter if available
        let selName = "_setPreferPageRenderingUpdatesNear60FPS:"
        let sel = Selector((selName))
        if preferences.responds(to: sel) {
            typealias SetBoolFunc = @convention(c) (AnyObject, Selector, Bool) -> Void
            let imp = preferences.method(for: sel)
            let callSetting = unsafeBitCast(imp, to: SetBoolFunc.self)
            callSetting(preferences, sel, false)
            print("[ProMotion] Successfully invoked _setPreferPageRenderingUpdatesNear60FPS:false")
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
