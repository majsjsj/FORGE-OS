import 'package:flutter/material.dart';

void main() => runApp(const ForgeDemoApp());

class ForgeDemoApp extends StatelessWidget {
  const ForgeDemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FORGE Cloud Build',
      theme: ThemeData(colorSchemeSeed: Colors.deepPurple, useMaterial3: true),
      home: Scaffold(
        appBar: AppBar(title: const Text('FORGE Cloud Build')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text('Built in the cloud. Ready for your next idea.'),
          ),
        ),
      ),
    );
  }
}
