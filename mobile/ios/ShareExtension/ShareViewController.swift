import UIKit
import UniformTypeIdentifiers

/// Zero-UI share extension: extract the shared URL, POST it to the ingest API,
/// and complete the request immediately so the user stays in the social app.
/// Feedback arrives via push notification from the backend.
final class ShareViewController: UIViewController {

    private let ingestEndpoint = URL(string: "https://api.example.com/v1/ingest")!

    override func viewDidLoad() {
        super.viewDidLoad()

        guard
            let item = extensionContext?.inputItems.first as? NSExtensionItem,
            let provider = item.attachments?.first(where: {
                $0.hasItemConformingToTypeIdentifier(UTType.url.identifier)
                    || $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)
            })
        else {
            return complete()
        }

        loadSharedURL(from: provider) { [weak self] url in
            guard let self, let url else { return self?.complete() ?? () }
            self.ingest(url: url)
        }
    }

    private func loadSharedURL(from provider: NSItemProvider, completion: @escaping (URL?) -> Void) {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier) { item, _ in
                completion(item as? URL)
            }
        } else {
            // TikTok sometimes shares the link as plain text.
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, _ in
                let text = item as? String
                completion(text.flatMap(URL.init(string:)))
            }
        }
    }

    private func ingest(url: URL) {
        var request = URLRequest(url: ingestEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // TODO: userId from the shared app-group keychain (main app writes it at login).
        let body = ["url": url.absoluteString, "userId": SharedAuth.userId]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { [weak self] _, _, _ in
            DispatchQueue.main.async { self?.complete() }
        }.resume()
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}

/// Placeholder for app-group shared credentials.
enum SharedAuth {
    static var userId: String {
        UserDefaults(suiteName: "group.com.example.locationsaver")?
            .string(forKey: "userId") ?? "anonymous"
    }
}
