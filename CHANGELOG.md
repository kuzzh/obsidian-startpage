# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2025-11-20

### ✨ New Features

- **File Search Modal**: Added a comprehensive file search functionality with three trigger methods:
  - Click the search icon in the top-right corner of the page
  - Press any non-function key while on the startpage
  - Click on statistics cards
  
- **Bookmark Import**: Added ability to import pinned notes from Obsidian bookmarks in the settings page

- **Custom Footer Text**: Added customizable footer text feature with two options:
  - Display random famous quotes
  - Display custom text messages

- **Statistics Cards Visibility Control**: Added option to hide statistics cards in the settings page

### 🐛 Bug Fixes

- **Mobile Display Issue**: Fixed display problems on mobile devices with notches (e.g., iPhone with Dynamic Island)
  - Solution: Enable "Show title navigation bar" in settings

### 🎨 Improvements

- **Enhanced Statistics Cards**: Statistics cards now trigger the file search modal when clicked, providing better user interaction
- **Better Mobile Experience**: Improved layout handling for devices with screen notches

### 📝 Related Issues

- Resolved [#1](https://github.com/kuzzh/obsidian-startpage/issues/1) - Optimized statistics card click operations
- Resolved [#2](https://github.com/kuzzh/obsidian-startpage/issues/2) - Added file search and statistics visibility controls
- Resolved [#3](https://github.com/kuzzh/obsidian-startpage/issues/3) - Implemented bookmark import feature
- Resolved [#4](https://github.com/kuzzh/obsidian-startpage/issues/4) - Custom click actions for statistics cards
- Resolved [#10](https://github.com/kuzzh/obsidian-startpage/issues/10) - Mobile display fixes and footer customization

---

## [0.2.1] - Previous Release

Initial stable release with core functionality:
- Automatic homepage on startup
- Dashboard statistics (total notes, today's edits, storage)
- Pinned notes section
- Recent notes section
- Multi-language support (zh/en)
- Light/dark theme adaptation
