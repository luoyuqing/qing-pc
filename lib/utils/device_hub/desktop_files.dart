import 'dart:io';

import 'package:path/path.dart' as path;
import 'package:shared_preferences/shared_preferences.dart';

class DesktopFiles {
  static const _key = 'qing.desktop.file_roots';

  static Future<List<String>> roots() async =>
      (await SharedPreferences.getInstance()).getStringList(_key) ?? [];

  static Future<void> setRoots(List<String> directories) async {
    await (await SharedPreferences.getInstance()).setStringList(
      _key,
      directories,
    );
  }

  static Future<List<Map<String, dynamic>>> search({
    int limit = 30,
    String query = '',
  }) async {
    final directories = await roots();
    if (directories.isEmpty) {
      throw StateError('请先在设备数据中选择允许索引的电脑目录');
    }
    return scan(directories, limit: limit, query: query);
  }

  static Future<List<Map<String, dynamic>>> scan(
    List<String> directories, {
    int limit = 30,
    String query = '',
  }) async {
    final results = <Map<String, dynamic>>[];
    final visited = <String>{};
    final maximum = limit.clamp(0, 500);
    var inspected = 0;
    final deadline = DateTime.now().add(const Duration(seconds: 8));
    Future<void> walk(Directory directory, int depth) async {
      if (depth > 6 ||
          inspected >= 20000 ||
          results.length >= maximum ||
          DateTime.now().isAfter(deadline)) {
        return;
      }
      try {
        await for (final entity in directory.list(followLinks: false)) {
          if (inspected++ >= 20000 ||
              results.length >= maximum ||
              DateTime.now().isAfter(deadline)) {
            return;
          }
          if (entity is Directory) {
            await walk(entity, depth + 1);
          } else if (entity is File &&
              path
                  .basename(entity.path)
                  .toLowerCase()
                  .contains(query.toLowerCase()) &&
              visited.add(path.normalize(entity.absolute.path))) {
            try {
              final stat = await entity.stat();
              results.add({
                'id': entity.absolute.path,
                'name': path.basename(entity.path),
                'path': entity.absolute.path,
                'size': stat.size,
                'modified': stat.modified.millisecondsSinceEpoch,
                'mime': null,
                'uri': entity.uri.toString(),
              });
            } on FileSystemException {
              continue;
            }
          }
        }
      } on FileSystemException {
        return;
      }
    }

    for (final directory in directories) {
      await walk(Directory(directory), 0);
    }
    return results;
  }
}
