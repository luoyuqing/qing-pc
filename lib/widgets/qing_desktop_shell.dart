import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

class QingDesktopShell extends StatelessWidget {
  const QingDesktopShell({super.key, required this.path, required this.child});

  final String path;
  final Widget child;

  static const destinations = [
    (route: '/rooms', label: '聊天', icon: Icons.chat_bubble_outline),
    (route: '/rooms/briefing', label: '简报', icon: Icons.article_outlined),
    (route: '/rooms/tasks', label: '任务', icon: Icons.task_alt_outlined),
    (route: '/rooms/memory', label: '记忆', icon: Icons.psychology_outlined),
    (route: '/rooms/services', label: '服务', icon: Icons.apps_outlined),
    (route: '/rooms/settings', label: '设置', icon: Icons.settings_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    final selected = destinations.lastIndexWhere(
      (destination) =>
          path == destination.route || path.startsWith('${destination.route}/'),
    );
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: MediaQuery.sizeOf(context).width >= 1440,
            leading: const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Text('Qing', style: TextStyle(fontSize: 22)),
            ),
            selectedIndex: selected < 0 ? 0 : selected,
            onDestinationSelected: (index) =>
                context.go(destinations[index].route),
            destinations: destinations
                .map(
                  (destination) => NavigationRailDestination(
                    icon: Icon(destination.icon),
                    label: Text(destination.label),
                  ),
                )
                .toList(),
          ),
          const VerticalDivider(width: 1),
          Expanded(child: child),
        ],
      ),
    );
  }
}
