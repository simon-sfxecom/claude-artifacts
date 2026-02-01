# Full-Screen Mode Feature für Claude Artifacts

## Beschreibung

Ermöglicht das Öffnen von Claude Artifacts Views im Full-Screen-Modus statt nur in der Seitenleiste.

## Use Cases

1. **Mission Control Fullscreen** - Bessere Übersicht über alle Sessions
2. **Plan Preview Fullscreen** - Mehr Platz für komplexe Mermaid-Diagramme
3. **Walkthrough Viewer Fullscreen** - Größere Screenshots/Videos ansehen
4. **Session Detail Fullscreen** - Mehr Kontext beim Review

## Technische Umsetzung

### Option 1: Webview Panel (Einfach)
- Öffnet View in neuem Editor Tab
- Nutzt VS Code's WebviewPanel API
- Beispiel: `claudeArtifacts.openMissionControlFullscreen`

```typescript
// Neuer Command in package.json
{
  "command": "claudeArtifacts.openFullscreen",
  "title": "Open in Fullscreen",
  "category": "Claude Artifacts",
  "icon": "$(fullscreen)"
}
```

### Option 2: Overlay/Modal (Aufwändiger)
- Transparenter Overlay über Editor
- Ähnlich VS Code's Command Palette
- Mehr Kontrolle über Layout

### Empfohlene Implementierung: Option 1

Einfacher, nutzt VS Code Native APIs, konsistent mit bestehendem Verhalten.

## UI/UX

### Neue Buttons
- Mission Control: "Open Fullscreen" (oben rechts)
- Plan Preview: "Expand to Fullscreen"
- Walkthrough: "Fullscreen Mode"

### Keyboard Shortcuts
| Aktion | Shortcut |
|--------|----------|
| Mission Control Fullscreen | `Cmd/Ctrl + Shift + M` (bestehend) → zusätzlich Fullscreen Option |
| Toggle Fullscreen | `Cmd/Ctrl + Shift + F11` |

## Dateien zu ändern

1. **package.json**
   - Neue Commands hinzufügen
   - Menu-Items für View-Titel

2. **src/extension.ts**
   - Command-Handler registrieren

3. **src/views/missionControlPanel.ts**
   - Methode: `openFullscreen()`
   - WebviewPanel statt WebviewView

4. **src/views/walkthroughViewerPanel.ts**
   - Ähnliche Fullscreen-Unterstützung

5. **src/views/artifactViewProvider.ts**
   - Plan Preview Fullscreen

## Beispiel-Implementierung (Mission Control)

```typescript
public openFullscreen() {
  const panel = vscode.window.createWebviewPanel(
    'claudeArtifacts.missionControlFullscreen',
    'Mission Control',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  
  panel.webview.html = this._getHtmlForWebview(panel.webview, true);
  
  // Gleiche Message-Handler wie in der Sidebar-Version
  panel.webview.onDidReceiveMessage(/* ... */);
}
```

## Vorteile

1. ✅ **Mehr Platz** - Besonders für komplexe Mermaid-Diagramme
2. ✅ **Bessere Fokussierung** - Weniger Ablenkung durch andere UI-Elemente
3. ✅ **Natürlicher Workflow** - Konsistent mit anderen VS Code Extensions
4. ✅ **Einfache Implementierung** - Nutzt bestehende Webview-Infrastruktur
5. ✅ **Kein Over-Engineering** - Passt perfekt zur bestehenden Architektur

## Integration mit bestehenden Features

- Fullscreen Mission Control → Click Session → Öffnet in Tab (bestehend)
- Fullscreen Walkthrough → Click Screenshot → Lightbox (bestehend)
- Fullscreen Plan Preview → Edit Plan → Öffnet in Editor (bestehend)

## Fazit

Ein Full-Screen-Modus ist ein **praktisches, fokussiertes Feature**, das:
- Die Nutzung verbessert
- Einfach zu implementieren ist
- Kein Over-Engineering darstellt
- Gut zur bestehenden Architektur passt

**Empfohlene Priorität:** Hoch - Quick Win! 🎯
