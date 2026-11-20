import 'package:material_ui/material_ui.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../../utils/device_hub/service_client.dart';

class WindowsServiceWebViewPage extends StatefulWidget {
  const WindowsServiceWebViewPage({
    super.key,
    required this.title,
    required this.url,
    required this.allowExternal,
  });

  final String title;
  final String url;
  final bool allowExternal;

  @override
  State<WindowsServiceWebViewPage> createState() =>
      _WindowsServiceWebViewPageState();
}

class _WindowsServiceWebViewPageState extends State<WindowsServiceWebViewPage> {
  InAppWebViewController? _controller;
  int _progress = 0;
  String? _error;

  bool _allowed(String raw) {
    final uri = Uri.tryParse(raw);
    if (uri == null || uri.host.isEmpty || uri.userInfo.isNotEmpty)
      return false;
    if (widget.allowExternal) {
      return uri.scheme == 'https' || uri.scheme == 'http';
    }
    return uri.scheme == 'https' && ServiceClient.isAllowedHost(uri.host);
  }

  @override
  Widget build(BuildContext context) {
    if (!_allowed(widget.url)) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.title)),
        body: const Center(child: Text('该地址不在允许打开的服务域名中')),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            tooltip: '后退',
            icon: const Icon(Icons.arrow_back),
            onPressed: () async {
              if (await _controller?.canGoBack() == true) {
                await _controller?.goBack();
              }
            },
          ),
          IconButton(
            tooltip: '刷新',
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() => _error = null);
              _controller?.reload();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          if (_progress < 100) LinearProgressIndicator(value: _progress / 100),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: SelectableText(_error!),
            ),
          Expanded(
            child: InAppWebView(
              initialUrlRequest: URLRequest(url: WebUri(widget.url)),
              initialSettings: InAppWebViewSettings(
                useShouldOverrideUrlLoading: true,
                javaScriptCanOpenWindowsAutomatically: false,
                supportMultipleWindows: false,
              ),
              onWebViewCreated: (controller) => _controller = controller,
              shouldOverrideUrlLoading: (controller, action) async =>
                  _allowed(action.request.url?.toString() ?? '')
                  ? NavigationActionPolicy.ALLOW
                  : NavigationActionPolicy.CANCEL,
              onReceivedServerTrustAuthRequest: (controller, challenge) async =>
                  ServerTrustAuthResponse(
                    action: ServerTrustAuthResponseAction.CANCEL,
                  ),
              onProgressChanged: (controller, progress) {
                if (mounted) setState(() => _progress = progress);
              },
              onReceivedError: (controller, request, error) {
                if (mounted && request.isForMainFrame == true) {
                  setState(
                    () => _error =
                        '页面加载失败：${error.description}。请检查网络及 WebView2 Runtime。',
                  );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}
