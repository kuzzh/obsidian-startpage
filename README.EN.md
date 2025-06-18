# Obsidian StartPage Plugin

English | [中文](README.md)

A startup homepage plugin for Obsidian that automatically displays a customized homepage upon startup, showcasing frequently used notes and recently modified notes.

## ✨ Features

- **Automatic Startup Homepage**: Automatically opens a customized homepage when the plugin starts
- **Pinned Notes**: Set important notes to be displayed at the top of the homepage
- **Recent Notes**: Display a list of recently modified notes, sorted by modification time
- **Smart Time Display**: Automatically shows relative time (minutes ago, hours ago, days ago)
- **Multi-language Support**: Supports both Chinese and English interfaces
- **Real-time Refresh**: Automatically refreshes homepage content when files change
- **Right-click Menu**: Supports right-click refresh functionality
- **Beautiful Interface**: Modern UI design that adapts to Obsidian themes

## 🚀 Installation

### Install from Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to the "Community plugins" tab
3. Turn off "Safe mode"
4. Click the "Browse" button
5. Search for "StartPage"
6. Click install and enable the plugin

### Manual Installation

1. Download the latest version of the plugin files
2. Copy `main.js`, `styles.css`, and `manifest.json` to your Obsidian vault's `.obsidian/plugins/start-page/` folder
3. Restart Obsidian
4. Enable the plugin in settings

## 📖 Usage

### Basic Usage

1. After installing and enabling the plugin, Obsidian will automatically display the startup homepage when launched
2. The homepage will show a welcome message and a list of recently modified notes
3. Click on note links to directly open the corresponding notes

### Setting Pinned Notes

1. Open Obsidian Settings
2. Find the "StartPage" settings tab
3. Click the "Select notes" button
4. Choose the notes to pin from the file tree popup
5. Pinned notes will be displayed in the "📌 Pinned notes" section on the homepage

### Custom Settings

- **Language**: Choose between Chinese and English interface
- **Recent Notes Count**: Set the number of recently modified notes to display on the homepage
- **Manage Pinned Notes**: Add or remove pinned notes

## 🛠️ Development

### Requirements

- Node.js 16.0 or higher
- Obsidian 0.15.0 or higher

### Development Setup

1. Clone the repository locally
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development mode:
   ```bash
   npm run dev
   ```
4. Link the plugin folder to your Obsidian vault's `.obsidian/plugins/` directory

### Build

```bash
npm run build
```

## 📝 Feature Details

### Startup Homepage Content

- **Welcome Message**: Displays personalized welcome message
- **Pinned Notes**: User-manually set frequently used notes
- **Recent Notes**: List of recently modified notes sorted by modification time
- **Time Tags**: Shows note modification time (relative or absolute time)
- **File Path**: Displays the folder path where the note is located

### Smart Refresh

- Automatically refreshes when files are modified
- Automatically refreshes when files are created/deleted/renamed
- Notes within 24 hours will trigger periodic refresh (every minute)
- Supports manual refresh (right-click menu)

### Multi-language Support

- Supports Chinese and English interfaces
- Can dynamically switch languages in settings
- Localized time format display

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

## 📄 License

MIT License

## 🙏 Acknowledgments

Thanks to the Obsidian team for providing excellent plugin APIs and development framework.

---

**❤️ Love what you love, and love what you do. ❤️** 