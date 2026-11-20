class ServiceGatewayConfig {
  ServiceGatewayConfig({required String url, required List<String> hosts})
    : url = _normalizeUrl(url),
      hosts = hosts.map(_normalizeHost).toSet().toList();

  final String url;
  final List<String> hosts;

  static String _normalizeUrl(String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.path.isNotEmpty && uri.path != '/')) {
      throw const FormatException('服务网关需要 HTTPS 地址，不能包含路径、凭据或查询参数');
    }
    return uri.replace(path: '').toString();
  }

  static String _normalizeHost(String value) {
    final host = value.trim().toLowerCase();
    final uri = Uri.tryParse('https://$host');
    if (host.isEmpty ||
        uri == null ||
        uri.host != host ||
        uri.userInfo.isNotEmpty ||
        uri.hasPort ||
        uri.path.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        host.contains('*')) {
      throw const FormatException('允许域名只能填写主机名，不能包含协议、端口或通配符');
    }
    return host;
  }

  bool allowsHost(String host) {
    final candidate = host.toLowerCase();
    return hosts.any((allowed) => candidate == allowed);
  }
}
