import 'package:fluffychat/widgets/qing_desktop_shell.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('memory has its own destination and content remains visible', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      const MaterialApp(
        home: QingDesktopShell(path: '/rooms/memory', child: Text('记忆详情')),
      ),
    );
    final rail = tester.widget<NavigationRail>(find.byType(NavigationRail));
    expect(rail.destinations, hasLength(6));
    expect(rail.selectedIndex, 3);
    expect(find.text('记忆详情'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
