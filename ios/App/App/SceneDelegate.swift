import UIKit
import WebKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        setupAudioLifecycleObservers()
    }

    private func setupAudioLifecycleObservers() {
        NotificationCenter.default.addObserver(self, selector: #selector(appWillResignActive), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(appDidEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(appWillEnterForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
    }

    @objc private func appWillResignActive() {
        self.webView?.evaluateJavaScript("window.audioEngine?.pauseAll?.();", completionHandler: nil)
    }

    @objc private func appDidEnterBackground() {
        self.webView?.evaluateJavaScript("window.audioEngine?.pauseAll?.();", completionHandler: nil)
    }

    @objc private func appDidBecomeActive() {
        self.webView?.evaluateJavaScript("window.audioEngine?.resumeAll?.();", completionHandler: nil)
    }

    @objc private func appWillEnterForeground() {
        self.webView?.evaluateJavaScript("window.audioEngine?.resumeAll?.();", completionHandler: nil)
    }

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

    func sceneWillResignActive(_ scene: UIScene) {
        if let mvc = window?.rootViewController as? MainViewController {
            mvc.webView?.evaluateJavaScript("window.audioEngine?.pauseAll?.();", completionHandler: nil)
        }
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        if let mvc = window?.rootViewController as? MainViewController {
            mvc.webView?.evaluateJavaScript("window.audioEngine?.pauseAll?.();", completionHandler: nil)
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        if let mvc = window?.rootViewController as? MainViewController {
            mvc.webView?.evaluateJavaScript("window.audioEngine?.resumeAll?.();", completionHandler: nil)
        }
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        if let mvc = window?.rootViewController as? MainViewController {
            mvc.webView?.evaluateJavaScript("window.audioEngine?.resumeAll?.();", completionHandler: nil)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
