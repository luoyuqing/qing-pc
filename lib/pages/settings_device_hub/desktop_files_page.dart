import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../utils/device_hub/desktop_files.dart';

class DesktopFilesPage extends StatefulWidget {
  const DesktopFilesPage({super.key});

  @override
  State<DesktopFilesPage> createState() => _DesktopFilesPageState();
}

class _DesktopFilesPageState extends State<DesktopFilesPage> {
  List<String> _roots = [];
  String? _message;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final roots = await DesktopFiles.roots();
      if (mounted)
        setState(() {
          _roots = roots;
          _busy = false;
        });
    } catch (error) {
      if (mounted)
        setState(() {
          _message = '$error';
          _busy = false;
        });
    }
  }

  Future<void> _change(Future<List<String>> Function() action) async {
    setState(() => _busy = true);
    try {
      final roots = await action();
      await DesktopFiles.setRoots(roots);
      if (mounted)
        setState(() {
          _roots = roots;
          _message = null;
        });
    } catch (error) {
      if (mounted) setState(() => _message = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('电脑文件索引')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text(
          '仅索引你选择的目录。助理请求时返回文件名、路径、大小和修改时间，不上传文件内容。移除目录后停止后续查询；历史记录按服务端保留策略清理。',
        ),
        const SizedBox(height: 16),
        for (final root in _roots)
          ListTile(
            leading: const Icon(Icons.folder_outlined),
            title: SelectableText(root),
            trailing: IconButton(
              tooltip: '撤销目录授权',
              icon: const Icon(Icons.delete_outline),
              onPressed: _busy
                  ? null
                  : () => _change(
                      () async => _roots.where((item) => item != root).toList(),
                    ),
            ),
          ),
        FilledButton.icon(
          onPressed: _busy
              ? null
              : () => _change(() async {
                final directory = await FilePicker.pickDirectory();
                final selected = directory?.toFilePath(windows: true);
                  return selected == null
                      ? _roots
                      : {..._roots, selected}.toList();
                }),
          icon: const Icon(Icons.create_new_folder_outlined),
          label: const Text('选择允许索引的目录'),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: _busy || _roots.isEmpty
              ? null
              : () async {
                  setState(() => _busy = true);
                  try {
                    final items = await DesktopFiles.search(limit: 10);
                    if (mounted)
                      setState(
                        () => _message =
                            '本机自检：${items.length} 条\n${items.map((item) => item['path']).join('\n')}',
                      );
                  } catch (error) {
                    if (mounted) setState(() => _message = '$error');
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
          child: const Text('本机自检（不上报）'),
        ),
        if (_busy) const LinearProgressIndicator(),
        if (_message != null)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: SelectableText(_message!),
          ),
      ],
    ),
  );
}
