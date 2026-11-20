import 'package:fluffychat/utils/device_hub/service_gateway_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('only explicitly configured hosts receive service navigation', () {
    final config = ServiceGatewayConfig(
      url: ' https://hub.example.com/ ',
      hosts: ['Notes.Example.com', 'files.example.com'],
    );
    expect(config.url, 'https://hub.example.com');
    expect(config.allowsHost('NOTES.example.com'), isTrue);
    expect(config.allowsHost('notes.example.com.attacker.test'), isFalse);
    expect(config.allowsHost('attacker-notes.example.com'), isFalse);
    expect(config.allowsHost('other.example.com'), isFalse);
    expect(config.allowsHost('3585616.xyz'), isFalse);
  });

  test('gateway rejects insecure URLs and embedded credentials', () {
    for (final url in [
      'http://hub.example.com',
      'https://user:secret@hub.example.com',
      'https://hub.example.com/path',
      'https://hub.example.com?token=secret',
      'https://hub.example.com#fragment',
      'not a url',
    ]) {
      expect(
        () => ServiceGatewayConfig(url: url, hosts: []),
        throwsFormatException,
        reason: url,
      );
    }
  });

  test('host list rejects URLs, wildcards and navigation syntax', () {
    for (final host in [
      '*.example.com',
      'https://notes.example.com',
      'example.com/path',
      'user@example.com',
      'example.com:443',
      'example.com?redirect=evil',
    ]) {
      expect(
        () =>
            ServiceGatewayConfig(url: 'https://hub.example.com', hosts: [host]),
        throwsFormatException,
        reason: host,
      );
    }
  });
}
