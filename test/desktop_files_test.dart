import 'dart:io';

import 'package:fluffychat/utils/device_hub/desktop_files.dart';
import 'package:fluffychat/pages/settings_device_hub/desktop_files_page.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('directory settings load without requesting file access', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const MaterialApp(home: DesktopFilesPage()));
    await tester.pumpAndSettle();
    expect(find.text('电脑文件索引'), findsOneWidget);
    expect(find.text('选择允许索引的目录'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  test(
    'file queries stay inside selected directories and respect limit',
    () async {
      final root = await Directory.systemTemp.createTemp('qing-file-test');
      addTearDown(() => root.delete(recursive: true));
      final selected = await Directory('${root.path}/selected').create();
      await File('${selected.path}/Report.txt').writeAsString('private');
      await File('${selected.path}/other.txt').writeAsString('other');
      await File('${root.path}/unselected.txt').writeAsString('outside');
      final items = await DesktopFiles.scan([selected.path], query: 'REPORT');
      expect(items, hasLength(1));
      expect(items.single['name'], 'Report.txt');
      expect(items.single['size'], 7);
      expect(items.single.containsKey('content'), isFalse);
      expect(await DesktopFiles.scan([selected.path], limit: 1), hasLength(1));
      expect(await DesktopFiles.scan([selected.path], limit: 0), isEmpty);
      expect(
        await DesktopFiles.scan([selected.path, selected.path]),
        hasLength(2),
      );
    },
  );
}
