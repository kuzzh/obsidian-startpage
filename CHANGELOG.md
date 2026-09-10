# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### ✨ New Features

- **Configurable New Note Creation**: The floating "New Note" button in the bottom right corner now creates notes based on your settings:
  - **Title Template**: Supports date/time placeholders with custom moment.js formats — `{{date}}`, `{{date:FORMAT}}`, `{{time}}`, `{{time:FORMAT}}` and `{{datetime:FORMAT}}`
  - **Target Folder**: Choose any folder in the vault, or leave empty for the vault root; missing folders are created automatically
  - **Conflict Behavior**: When the generated title already exists, either create a numbered copy or open the existing note
  - Characters that are illegal in file names (`/ \ : * ? " < > |`) are automatically replaced with `-`
  - Live title preview in the settings page as you edit the template

### 🐛 Bug Fixes

- **Duplicated Start Page Content**: Deleting a folder duplicated the entire start page once per file it contained. Concurrent vault events triggered overlapping renders that interleaved around an internal `await`; renders are now serialized and coalesced
- **Duplicate Tab**: With the "open existing note" conflict behavior, clicking the new note button now activates the already-open tab instead of opening the same file in a second tab
- **Settings Scroll Position**: Using the target folder "Select folder" or "Clear" buttons no longer scrolls the settings page back to the top

---

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
