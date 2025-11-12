# Test Suite for AIVerse Manager

This directory contains comprehensive Vitest tests for the AIVerse Manager application.

## Test Structure

```
tests/
├── setup.js                 # Global test setup and configuration
├── mocks/
│   └── electron.js         # Mock implementations of Electron APIs
├── components/             # React component tests
│   ├── ToolForm.test.jsx
│   ├── Sidebar.test.jsx
│   └── ToolIcon.test.jsx
├── db.test.js              # Database module tests
├── ipc.test.js             # IPC handler tests
├── toolTemplates.test.js   # Tool templates data tests
└── README.md               # This file
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Coverage

### Database Tests (`db.test.js`)
- Database schema creation
- Table structure validation
- Foreign key constraints
- Migration logic
- Journal mode configuration

### IPC Handler Tests (`ipc.test.js`)
- Tools CRUD operations (create, read, update, delete, list)
- Prompts CRUD operations
- File and image operations
- Error handling
- Window notification system

### Component Tests
- **ToolForm**: Form validation, template application, file/folder selection
- **Sidebar**: Tool listing, navigation, collapse/expand functionality
- **ToolIcon**: Icon loading from various sources (data URLs, HTTP URLs, filesystem)

### Data Tests (`toolTemplates.test.js`)
- Template structure validation
- Required properties
- Unique ID validation
- URL format validation

## Mocking

The tests use mocked Electron APIs to simulate the Electron environment without requiring the full Electron runtime. Key mocks include:

- `electron.app` - Application paths
- `electron.BrowserWindow` - Window management
- `electron.dialog` - File/folder dialogs
- `electron.shell` - External operations
- `electron.ipcMain` - IPC handlers

## Writing New Tests

When adding new features:

1. **For new IPC handlers**: Add tests in `tests/ipc.test.js`
2. **For new components**: Create `tests/components/ComponentName.test.jsx`
3. **For new utilities**: Create `tests/utilityName.test.js`

### Example Test Structure

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up resources in `afterEach` hooks
3. **Mocking**: Mock external dependencies (Electron APIs, file system, etc.)
4. **Assertions**: Use descriptive assertions with clear error messages
5. **Coverage**: Aim for high coverage of critical business logic

## Troubleshooting

### Tests failing with "Cannot find module"
- Run `npm install` to ensure all dependencies are installed
- Check that module paths are correct

### Electron mock issues
- Ensure mocks are properly imported in test files
- Check that `vi.mock()` is called before imports

### Database tests failing with "NODE_MODULE_VERSION" error
If you see an error like:
```
was compiled against a different Node.js version using NODE_MODULE_VERSION 123. 
This version of Node.js requires NODE_MODULE_VERSION 127.
```

This means `better-sqlite3` native module needs to be rebuilt for your Node.js version:
```bash
npm rebuild better-sqlite3
```

Or reinstall dependencies:
```bash
npm install
```

### Database tests - general issues
- Ensure test database directory exists
- Check that cleanup is properly removing test database files
- If database tests still fail, try deleting `node_modules` and reinstalling

