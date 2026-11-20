import 'package:material_ui/material_ui.dart';

import '../../utils/device_hub/service_client.dart';
import '../../utils/device_hub/service_gateway_config.dart';

class ServiceGatewayDialog extends StatefulWidget {
  const ServiceGatewayDialog({super.key, this.configuration});

  final ServiceGatewayConfig? configuration;

  @override
  State<ServiceGatewayDialog> createState() => _ServiceGatewayDialogState();
}

class _ServiceGatewayDialogState extends State<ServiceGatewayDialog> {
  final _url = TextEditingController();
  final _hosts = TextEditingController();
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _url.text = widget.configuration?.url ?? '';
    _hosts.text = widget.configuration?.hosts.join('\n') ?? '';
  }

  @override
  void dispose() {
    _url.dispose();
    _hosts.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final config = ServiceGatewayConfig(
        url: _url.text,
        hosts: _hosts.text
            .split(RegExp(r'[\s,，]+'))
            .where((host) => host.isNotEmpty)
            .toList(),
      );
      if (config.hosts.isEmpty) {
        throw const FormatException('请至少填写一个允许打开的服务域名');
      }
      await ServiceClient.saveConfiguration(config);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = '$error';
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('连接现有服务网关'),
    content: SizedBox(
      width: 480,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('填写提供服务目录与登录票据的网关。它可以与 device-hub 使用不同地址。'),
            const SizedBox(height: 16),
            TextField(
              controller: _url,
              enabled: !_saving,
              decoration: const InputDecoration(
                labelText: 'HTTPS 网关地址',
                hintText: 'https://hub.example.com',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _hosts,
              enabled: !_saving,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(
                labelText: '允许打开的服务域名',
                helperText: '每行一个完整域名，包括票据跳转的目标域名',
                hintText: 'notes.example.com\nfiles.example.com',
              ),
            ),
            if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: _saving ? null : () => Navigator.of(context).pop(),
        child: const Text('取消'),
      ),
      FilledButton(
        onPressed: _saving ? null : _save,
        child: Text(_saving ? '保存中…' : '保存'),
      ),
    ],
  );
}
