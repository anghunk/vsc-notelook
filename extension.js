const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { t } = require('./i18n');

/**
 * TreeDataProvider for NoteLook file explorer
 */
class NoteLookTreeDataProvider {
	constructor(context) {
		this.context = context;
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		
		// Load saved folder path from global state (not workspace state)
		this.rootPath = context.globalState.get('notelook.rootPath', null);
		// Load hidden items from global state
		this.hiddenItems = new Set(context.globalState.get('notelook.hiddenItems', []));
		// Search filter
		this.searchFilter = '';
	}

	// Required for drag and drop
	dropMimeTypes = ['application/vnd.code.tree.notelook'];
	dragMimeTypes = ['application/vnd.code.tree.notelook'];

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	setRootPath(folderPath) {
		this.rootPath = folderPath;
		this.context.globalState.update('notelook.rootPath', folderPath);
		this.refresh();
	}

	hideItem(filePath) {
		this.hiddenItems.add(filePath);
		this.context.globalState.update('notelook.hiddenItems', Array.from(this.hiddenItems));
		this.refresh();
	}

	showItem(filePath) {
		this.hiddenItems.delete(filePath);
		this.context.globalState.update('notelook.hiddenItems', Array.from(this.hiddenItems));
		this.refresh();
	}

	isHidden(filePath) {
		return this.hiddenItems.has(filePath);
	}

	setSearchFilter(filter) {
		this.searchFilter = filter.toLowerCase();
		this.refresh();
	}

	clearSearchFilter() {
		this.searchFilter = '';
		this.refresh();
	}

	matchesSearch(itemName) {
		if (!this.searchFilter) {
			return true;
		}
		return itemName.toLowerCase().includes(this.searchFilter);
	}

	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		if (!this.rootPath) {
			return Promise.resolve([]);
		}

		if (!element) {
			// Root level
			if (this.searchFilter) {
				// If searching, show all matching items recursively
				return Promise.resolve(this.searchFilesAndFolders(this.rootPath));
			} else {
				// Normal browsing
				return Promise.resolve(this.getFilesAndFolders(this.rootPath));
			}
		} else {
			// Child level - only in normal browsing mode
			if (!this.searchFilter) {
				return Promise.resolve(this.getFilesAndFolders(element.resourceUri.fsPath));
			}
			return Promise.resolve([]);
		}
	}

	// Drag and Drop support
	handleDrag(source, dataTransfer, token) {
		if (source && source.length > 0) {
			const items = source.map(item => item.resourceUri.fsPath);
			dataTransfer.set('application/vnd.code.tree.notelook', new vscode.DataTransferItem(items));
			console.log('Dragging items:', items);
		}
	}

	async handleDrop(target, dataTransfer, token) {
		console.log('handleDrop called, target:', target);
		const transferItem = dataTransfer.get('application/vnd.code.tree.notelook');
		if (!transferItem) {
			console.log('No transfer item found');
			return;
		}

		const sourcePaths = transferItem.value;
		console.log('Source paths:', sourcePaths);
		let targetDir;

		if (target) {
			// Dropped on a file or folder
			const targetPath = target.resourceUri.fsPath;
			console.log('Target path:', targetPath);
			const stat = fs.statSync(targetPath);
			targetDir = stat.isDirectory() ? targetPath : path.dirname(targetPath);
		} else {
			// Dropped on the root
			targetDir = this.rootPath;
		}

		console.log('Target directory:', targetDir);

		if (!targetDir) {
			return;
		}

		// Move each source to target
		for (const sourcePath of sourcePaths) {
			const sourceName = path.basename(sourcePath);
			const newPath = path.join(targetDir, sourceName);

			console.log(`Moving ${sourcePath} to ${newPath}`);

			// Check if source is being moved to itself or its parent
			if (sourcePath === newPath) {
				console.log('Source and target are the same, skipping');
				continue;
			}

			// Check if source is being moved to its current directory
			if (path.dirname(sourcePath) === targetDir) {
				console.log('Already in target directory, skipping');
				continue;
			}

			// Check if target already exists
			if (fs.existsSync(newPath)) {
				vscode.window.showWarningMessage(t('warn.targetExists', sourceName));
				continue;
			}

			// Check if trying to move a folder into itself
			if (fs.statSync(sourcePath).isDirectory() && newPath.startsWith(sourcePath + path.sep)) {
				vscode.window.showWarningMessage(t('warn.cannotMoveToSelf'));
				continue;
			}

			try {
				fs.renameSync(sourcePath, newPath);
				console.log('Move successful');
				vscode.window.showInformationMessage(t('msg.itemMoved', sourceName));
			} catch (error) {
				console.error('Move failed:', error);
				vscode.window.showErrorMessage(t('error.moveFailed', error.message));
			}
		}

		this.refresh();
	}

	getFilesAndFolders(dirPath) {
		if (!fs.existsSync(dirPath)) {
			return [];
		}

		try {
			const items = fs.readdirSync(dirPath);
			const folders = [];
			const files = [];

			items.forEach(item => {
				const fullPath = path.join(dirPath, item);
				
				// Skip hidden items
				if (this.isHidden(fullPath)) {
					return;
				}
				
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					folders.push(new FileTreeItem(
						item,
						fullPath,
						vscode.TreeItemCollapsibleState.Collapsed,
						true
					));
				} else {
					files.push(new FileTreeItem(
						item,
						fullPath,
						vscode.TreeItemCollapsibleState.None,
						false
					));
				}
			});

			// Sort folders and files alphabetically
			folders.sort((a, b) => a.label.localeCompare(b.label));
			files.sort((a, b) => a.label.localeCompare(b.label));

			// Return folders first, then files
			return [...folders, ...files];
		} catch (error) {
			console.error('Error reading directory:', error);
			return [];
		}
	}

	searchFilesAndFolders(dirPath) {
		if (!fs.existsSync(dirPath)) {
			return [];
		}

		try {
			const results = [];
			this.searchRecursive(dirPath, results);
			
			// Sort results: folders first, then files
			const folders = results.filter(item => item.isDirectory);
			const files = results.filter(item => !item.isDirectory);
			
			folders.sort((a, b) => a.label.localeCompare(b.label));
			files.sort((a, b) => a.label.localeCompare(b.label));
			
			return [...folders, ...files];
		} catch (error) {
			console.error('Error searching directory:', error);
			return [];
		}
	}

	searchRecursive(dirPath, results) {
		try {
			const items = fs.readdirSync(dirPath);
			
			items.forEach(item => {
				const fullPath = path.join(dirPath, item);
				
				// Skip hidden items
				if (this.isHidden(fullPath)) {
					return;
				}
				
				const stat = fs.statSync(fullPath);
				
				// Check if item matches search
				if (this.matchesSearch(item)) {
					if (stat.isDirectory()) {
						results.push(new FileTreeItem(
							item,
							fullPath,
							vscode.TreeItemCollapsibleState.None,  // Flatten in search results
							true,
							this.getRelativePath(fullPath)  // Show relative path
						));
					} else {
						results.push(new FileTreeItem(
							item,
							fullPath,
							vscode.TreeItemCollapsibleState.None,
							false,
							this.getRelativePath(fullPath)  // Show relative path
						));
					}
				}
				
				// Continue searching in subdirectories
				if (stat.isDirectory()) {
					this.searchRecursive(fullPath, results);
				}
			});
		} catch (error) {
			// Ignore permission errors and continue
		}
	}

	getRelativePath(fullPath) {
		if (!this.rootPath) {
			return '';
		}
		return path.relative(this.rootPath, path.dirname(fullPath));
	}
}

/**
 * TreeDataProvider for hidden items
 */
class HiddenItemsProvider {
	constructor(treeDataProvider) {
		this.treeDataProvider = treeDataProvider;
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		if (!element) {
			// Root level - show all hidden items
			const hiddenPaths = Array.from(this.treeDataProvider.hiddenItems);
			return Promise.resolve(hiddenPaths.map(filePath => {
				const fileName = path.basename(filePath);
				const isDirectory = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
				return new HiddenTreeItem(
					fileName,
					filePath,
					isDirectory
				);
			}));
		}
		return Promise.resolve([]);
	}
}

/**
 * TreeDataProvider for favorites
 */
class FavoritesProvider {
	constructor(context) {
		this.context = context;
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this.favorites = new Set(context.globalState.get('notelook.favorites', []));
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	addFavorite(filePath) {
		this.favorites.add(filePath);
		this.context.globalState.update('notelook.favorites', Array.from(this.favorites));
		this.refresh();
	}

	removeFavorite(filePath) {
		this.favorites.delete(filePath);
		this.context.globalState.update('notelook.favorites', Array.from(this.favorites));
		this.refresh();
	}

	isFavorite(filePath) {
		return this.favorites.has(filePath);
	}

	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		if (!element) {
			// Root level - show all favorites
			const favoritePaths = Array.from(this.favorites);
			return Promise.resolve(favoritePaths.map(filePath => {
				if (!fs.existsSync(filePath)) {
					return null;
				}
				const fileName = path.basename(filePath);
				const stat = fs.statSync(filePath);
				const isDirectory = stat.isDirectory();
				return new FavoriteTreeItem(
					fileName,
					filePath,
					isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
					isDirectory
				);
			}).filter(item => item !== null));
		} else if (element.isDirectory) {
			// Show children of favorited folder
			return Promise.resolve(this.getFilesAndFolders(element.resourceUri.fsPath));
		}
		return Promise.resolve([]);
	}

	getFilesAndFolders(dirPath) {
		if (!fs.existsSync(dirPath)) {
			return [];
		}

		try {
			const items = fs.readdirSync(dirPath);
			const folders = [];
			const files = [];

			items.forEach(item => {
				const fullPath = path.join(dirPath, item);
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					folders.push(new FavoriteTreeItem(
						item,
						fullPath,
						vscode.TreeItemCollapsibleState.Collapsed,
						true
					));
				} else {
					files.push(new FavoriteTreeItem(
						item,
						fullPath,
						vscode.TreeItemCollapsibleState.None,
						false
					));
				}
			});

			folders.sort((a, b) => a.label.localeCompare(b.label));
			files.sort((a, b) => a.label.localeCompare(b.label));

			return [...folders, ...files];
		} catch (error) {
			return [];
		}
	}
}

/**
 * TreeDataProvider for recent files
 */
class RecentFilesProvider {
	constructor(context) {
		this.context = context;
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this.recentFiles = context.globalState.get('notelook.recentFiles', []);
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	addRecentFile(filePath) {
		// Remove if already exists
		this.recentFiles = this.recentFiles.filter(f => f !== filePath);
		// Add to the beginning
		this.recentFiles.unshift(filePath);
		// Keep only last 20 files
		this.recentFiles = this.recentFiles.slice(0, 20);
		this.context.globalState.update('notelook.recentFiles', this.recentFiles);
		this.refresh();
	}

	clearRecent() {
		this.recentFiles = [];
		this.context.globalState.update('notelook.recentFiles', []);
		this.refresh();
	}

	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		if (!element) {
			// Root level - show all recent files
			return Promise.resolve(this.recentFiles.map(filePath => {
				if (!fs.existsSync(filePath)) {
					return null;
				}
				const fileName = path.basename(filePath);
				return new RecentTreeItem(
					fileName,
					filePath,
					filePath
				);
			}).filter(item => item !== null));
		}
		return Promise.resolve([]);
	}
}

/**
 * TreeItem for hidden items
 */
class HiddenTreeItem extends vscode.TreeItem {
	constructor(label, filePath, isDirectory) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.resourceUri = vscode.Uri.file(filePath);
		this.isDirectory = isDirectory;
		this.contextValue = 'hidden';
		this.description = filePath;
		
		if (!isDirectory && fs.existsSync(filePath)) {
			this.command = {
				command: 'notelook.openFile',
				title: 'Open File',
				arguments: [this.resourceUri]
			};
		}
	}
}

/**
 * TreeItem for favorite items
 */
class FavoriteTreeItem extends vscode.TreeItem {
	constructor(label, filePath, collapsibleState, isDirectory) {
		super(label, collapsibleState);
		this.resourceUri = vscode.Uri.file(filePath);
		this.isDirectory = isDirectory;
		this.contextValue = 'favorite';
		
		if (!isDirectory) {
			this.command = {
				command: 'notelook.openFile',
				title: 'Open File',
				arguments: [this.resourceUri]
			};
		}
	}
}

/**
 * TreeItem for recent files
 */
class RecentTreeItem extends vscode.TreeItem {
	constructor(label, filePath, description) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.resourceUri = vscode.Uri.file(filePath);
		this.description = description;
		this.contextValue = 'recent';
		
		this.command = {
			command: 'notelook.openFile',
			title: 'Open File',
			arguments: [this.resourceUri]
		};
	}
}

/**
 * TreeItem for files and folders
 */
class FileTreeItem extends vscode.TreeItem {
	constructor(label, filePath, collapsibleState, isDirectory, description) {
		super(label, collapsibleState);
		this.resourceUri = vscode.Uri.file(filePath);
		this.isDirectory = isDirectory;
		this.description = description || '';  // Show relative path in search results

		if (!isDirectory) {
			this.command = {
				command: 'notelook.openFile',
				title: 'Open File',
				arguments: [this.resourceUri]
			};
			this.contextValue = 'file';
		} else {
			this.contextValue = 'folder';
		}
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('NoteLook extension is now active!');

	// Create tree data provider
	const treeDataProvider = new NoteLookTreeDataProvider(context);
	
	// Create hidden items provider
	const hiddenItemsProvider = new HiddenItemsProvider(treeDataProvider);
	
	// Create favorites provider
	const favoritesProvider = new FavoritesProvider(context);
	
	// Create recent files provider
	const recentFilesProvider = new RecentFilesProvider(context);
	
	// Clipboard for copy/cut operations
	let clipboard = { path: null, isCut: false };
	
	// Register tree view
	const treeView = vscode.window.createTreeView('notelook.explorer', {
		treeDataProvider: treeDataProvider,
		showCollapseAll: true,
		dragAndDropController: treeDataProvider
	});

	// Register hidden items view
	const hiddenView = vscode.window.createTreeView('notelook.hidden', {
		treeDataProvider: hiddenItemsProvider,
		showCollapseAll: false
	});

	// Register favorites view
	const favoritesView = vscode.window.createTreeView('notelook.favorites', {
		treeDataProvider: favoritesProvider,
		showCollapseAll: true
	});

	// Register recent files view
	const recentView = vscode.window.createTreeView('notelook.recent', {
		treeDataProvider: recentFilesProvider,
		showCollapseAll: false
	});

	// Register add folder command
	const addFolderCommand = vscode.commands.registerCommand('notelook.addFolder', async () => {
			const options = {
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			openLabel: t('input.selectFolder')
		};

		const folderUri = await vscode.window.showOpenDialog(options);
			if (folderUri && folderUri[0]) {
			treeDataProvider.setRootPath(folderUri[0].fsPath);
			vscode.window.showInformationMessage(t('msg.folderAdded', folderUri[0].fsPath));
		}
	});

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand('notelook.refresh', () => {
		treeDataProvider.refresh();
		hiddenItemsProvider.refresh();
	});

	// Register open file command
	const openFileCommand = vscode.commands.registerCommand('notelook.openFile', async (uri) => {
		if (uri) {
			// Open file in preview mode (like explorer)
			const document = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(document, {
				viewColumn: vscode.ViewColumn.One,
				preview: true  // Enable preview mode
			});
		}
	});

	// Register hide item command
	const hideItemCommand = vscode.commands.registerCommand('notelook.hideItem', async (item) => {
			if (item && item.resourceUri) {
			const filePath = item.resourceUri.fsPath;
			treeDataProvider.hideItem(filePath);
			hiddenItemsProvider.refresh();
			vscode.window.showInformationMessage(t('msg.itemHidden', path.basename(filePath)));
		}
	});

	// Register show item command
	const showItemCommand = vscode.commands.registerCommand('notelook.showItem', async (item) => {
			if (item && item.resourceUri) {
			const filePath = item.resourceUri.fsPath;
			treeDataProvider.showItem(filePath);
			hiddenItemsProvider.refresh();
			vscode.window.showInformationMessage(t('msg.itemShown', path.basename(filePath)));
		}
	});

	// Register rename item command
	const renameItemCommand = vscode.commands.registerCommand('notelook.renameItem', async (item) => {
			if (item && item.resourceUri) {
			const oldPath = item.resourceUri.fsPath;
			const oldName = path.basename(oldPath);
			const dirPath = path.dirname(oldPath);

			const newName = await vscode.window.showInputBox({
				prompt: t('input.enterNewName'),
				value: oldName,
				validateInput: (value) => {
					if (!value || value.trim() === '') {
						return t('validate.nameEmpty');
					}
					if (value.includes('/') || value.includes('\\')) {
						return t('validate.nameNoSeparator');
					}
					return null;
				}
			});

			if (newName && newName !== oldName) {
				const newPath = path.join(dirPath, newName);
				try {
					fs.renameSync(oldPath, newPath);
					treeDataProvider.refresh();
					vscode.window.showInformationMessage(t('msg.itemRenamed', oldName, newName));
				} catch (error) {
					vscode.window.showErrorMessage(t('error.renameFailed', error.message));
				}
			}
		}
	});

	// Register delete item command
	const deleteItemCommand = vscode.commands.registerCommand('notelook.deleteItem', async (item) => {
			if (item && item.resourceUri) {
			const filePath = item.resourceUri.fsPath;
			const fileName = path.basename(filePath);
			
			const answer = await vscode.window.showWarningMessage(
				t('confirm.delete', fileName),
				{ modal: true },
				t('confirm.deleteButton')
			);

			if (answer === t('confirm.deleteButton')) {
				try {
					const stat = fs.statSync(filePath);
					if (stat.isDirectory()) {
						fs.rmSync(filePath, { recursive: true, force: true });
					} else {
						fs.unlinkSync(filePath);
					}
					treeDataProvider.refresh();
					vscode.window.showInformationMessage(t('msg.itemDeleted', fileName));
				} catch (error) {
					vscode.window.showErrorMessage(t('error.deleteFailed', error.message));
				}
			}
		}
	});

	// Register copy item command
	const copyItemCommand = vscode.commands.registerCommand('notelook.copyItem', async (item) => {
			if (item && item.resourceUri) {
			clipboard = { path: item.resourceUri.fsPath, isCut: false };
			vscode.window.showInformationMessage(t('msg.itemCopied', path.basename(clipboard.path)));
		}
	});

	// Register cut item command
	const cutItemCommand = vscode.commands.registerCommand('notelook.cutItem', async (item) => {
			if (item && item.resourceUri) {
			clipboard = { path: item.resourceUri.fsPath, isCut: true };
			vscode.window.showInformationMessage(t('msg.itemCut', path.basename(clipboard.path)));
		}
	});

	// Register paste item command
	const pasteItemCommand = vscode.commands.registerCommand('notelook.pasteItem', async (item) => {
		if (!clipboard.path) {
			vscode.window.showWarningMessage(t('warn.clipboardEmpty'));
			return;
		}

		let targetDir;
		if (item && item.resourceUri) {
			const targetPath = item.resourceUri.fsPath;
			const stat = fs.statSync(targetPath);
			targetDir = stat.isDirectory() ? targetPath : path.dirname(targetPath);
		} else {
			targetDir = treeDataProvider.rootPath;
		}

		if (!targetDir) {
			vscode.window.showWarningMessage(t('warn.targetDirNotExists'));
			return;
		}

		const sourceName = path.basename(clipboard.path);
		const targetPath = path.join(targetDir, sourceName);

		try {
			if (clipboard.isCut) {
				// Move
				fs.renameSync(clipboard.path, targetPath);
				vscode.window.showInformationMessage(t('msg.itemMoved', sourceName));
				clipboard = { path: null, isCut: false };
			} else {
				// Copy
				const stat = fs.statSync(clipboard.path);
				if (stat.isDirectory()) {
					copyDirectory(clipboard.path, targetPath);
				} else {
					fs.copyFileSync(clipboard.path, targetPath);
				}
				vscode.window.showInformationMessage(t('msg.itemPasted', sourceName));
			}
			treeDataProvider.refresh();
		} catch (error) {
			vscode.window.showErrorMessage(t('error.pasteFailed', error.message));
		}
	});

	// Register new file command
	const newFileCommand = vscode.commands.registerCommand('notelook.newFile', async (item) => {
		let targetDir;
		if (item && item.resourceUri) {
			targetDir = item.resourceUri.fsPath;
		} else {
			targetDir = treeDataProvider.rootPath;
		}

		if (!targetDir) {
			vscode.window.showWarningMessage(t('warn.selectDirFirst'));
			return;
		}

		const fileName = await vscode.window.showInputBox({
			prompt: t('input.enterFileName'),
			validateInput: (value) => {
				if (!value || value.trim() === '') {
					return t('validate.fileNameEmpty');
				}
				if (value.includes('/') || value.includes('\\')) {
					return t('validate.fileNameNoSeparator');
				}
				return null;
			}
		});

		if (fileName) {
			const filePath = path.join(targetDir, fileName);
			try {
				fs.writeFileSync(filePath, '', 'utf8');
				treeDataProvider.refresh();
				// Open the new file in non-preview mode (keep tab)
				const document = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(document, {
					preview: false  // Don't use preview mode for newly created files
				});
			} catch (error) {
				vscode.window.showErrorMessage(t('error.createFileFailed', error.message));
			}
		}
	});

	// Register new folder command
	const newFolderCommand = vscode.commands.registerCommand('notelook.newFolder', async (item) => {
		let targetDir;
		if (item && item.resourceUri) {
			targetDir = item.resourceUri.fsPath;
		} else {
			targetDir = treeDataProvider.rootPath;
		}

		if (!targetDir) {
			vscode.window.showWarningMessage(t('warn.selectDirFirst'));
			return;
		}

		const folderName = await vscode.window.showInputBox({
			prompt: t('input.enterFolderName'),
			validateInput: (value) => {
				if (!value || value.trim() === '') {
					return t('validate.folderNameEmpty');
				}
				if (value.includes('/') || value.includes('\\')) {
					return t('validate.folderNameNoSeparator');
				}
				return null;
			}
		});

		if (folderName) {
			const folderPath = path.join(targetDir, folderName);
			try {
				fs.mkdirSync(folderPath);
				treeDataProvider.refresh();
				vscode.window.showInformationMessage(t('msg.folderCreated', folderName));
			} catch (error) {
				vscode.window.showErrorMessage(t('error.createFolderFailed', error.message));
			}
		}
	});

	// Register search command
	const searchCommand = vscode.commands.registerCommand('notelook.search', async () => {
		const searchBox = vscode.window.createInputBox();
		searchBox.placeholder = t('input.searchPlaceholder');
		searchBox.value = treeDataProvider.searchFilter;
		searchBox.prompt = t('input.searchPrompt');

		// Real-time search on input change
		searchBox.onDidChangeValue((value) => {
			if (value.trim() === '') {
				treeDataProvider.clearSearchFilter();
			} else {
				treeDataProvider.setSearchFilter(value);
			}
		});

		searchBox.onDidAccept(() => {
			searchBox.hide();
		});

		searchBox.onDidHide(() => {
			searchBox.dispose();
		});

		searchBox.show();
	});

	// Register clear search command
	const clearSearchCommand = vscode.commands.registerCommand('notelook.clearSearch', () => {
		treeDataProvider.clearSearchFilter();
		vscode.window.showInformationMessage(t('msg.searchCleared'));
	});

	// Register preview markdown command
	const previewMarkdownCommand = vscode.commands.registerCommand('notelook.previewMarkdown', async (item) => {
		if (!item || !item.resourceUri) {
			return;
		}

		const filePath = item.resourceUri.fsPath;
		const ext = path.extname(filePath).toLowerCase();

		if (ext !== '.md' && ext !== '.markdown') {
			vscode.window.showWarningMessage(t('warn.onlyMarkdownPreview'));
			return;
		}

		try {
			// Open the markdown file in editor
			const document = await vscode.workspace.openTextDocument(item.resourceUri);
			await vscode.window.showTextDocument(document, {
				viewColumn: vscode.ViewColumn.One,
				preview: false
			});

			// Open markdown preview to the side
			await vscode.commands.executeCommand('markdown.showPreviewToSide', item.resourceUri);
		} catch (error) {
			vscode.window.showErrorMessage(t('error.previewFailed', error.message));
		}
	});

	// Register add to favorites command
	const addToFavoritesCommand = vscode.commands.registerCommand('notelook.addToFavorites', async (item) => {
		if (item && item.resourceUri) {
			const filePath = item.resourceUri.fsPath;
			favoritesProvider.addFavorite(filePath);
			vscode.window.showInformationMessage(t('msg.addedToFavorites', path.basename(filePath)));
		}
	});

	// Register remove from favorites command
	const removeFromFavoritesCommand = vscode.commands.registerCommand('notelook.removeFromFavorites', async (item) => {
		if (item && item.resourceUri) {
			const filePath = item.resourceUri.fsPath;
			favoritesProvider.removeFavorite(filePath);
			vscode.window.showInformationMessage(t('msg.removedFromFavorites', path.basename(filePath)));
		}
	});

	// Register clear recent command
	const clearRecentCommand = vscode.commands.registerCommand('notelook.clearRecent', () => {
		recentFilesProvider.clearRecent();
		vscode.window.showInformationMessage(t('msg.recentCleared'));
	});

	// Listen to document save events to track recent files
	const onDidSaveDocument = vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.uri.scheme === 'file') {
			const filePath = document.uri.fsPath;
			// Only add if file is within the root path or is a favorite
			if (treeDataProvider.rootPath && filePath.startsWith(treeDataProvider.rootPath)) {
				recentFilesProvider.addRecentFile(filePath);
			} else if (favoritesProvider.isFavorite(filePath)) {
				recentFilesProvider.addRecentFile(filePath);
			}
		}
	});

	// Listen to document change events to track modified files
	const onDidChangeDocument = vscode.workspace.onDidChangeTextDocument((event) => {
		if (event.document.uri.scheme === 'file' && event.document.isDirty) {
			const filePath = event.document.uri.fsPath;
			// Only add if file is within the root path or is a favorite
			if (treeDataProvider.rootPath && filePath.startsWith(treeDataProvider.rootPath)) {
				recentFilesProvider.addRecentFile(filePath);
			} else if (favoritesProvider.isFavorite(filePath)) {
				recentFilesProvider.addRecentFile(filePath);
			}
		}
	});

	context.subscriptions.push(treeView);
	context.subscriptions.push(hiddenView);
	context.subscriptions.push(favoritesView);
	context.subscriptions.push(recentView);
	context.subscriptions.push(addFolderCommand);
	context.subscriptions.push(refreshCommand);
	context.subscriptions.push(openFileCommand);
	context.subscriptions.push(hideItemCommand);
	context.subscriptions.push(showItemCommand);
	context.subscriptions.push(renameItemCommand);
	context.subscriptions.push(deleteItemCommand);
	context.subscriptions.push(copyItemCommand);
	context.subscriptions.push(cutItemCommand);
	context.subscriptions.push(pasteItemCommand);
	context.subscriptions.push(newFileCommand);
	context.subscriptions.push(newFolderCommand);
	context.subscriptions.push(searchCommand);
	context.subscriptions.push(clearSearchCommand);
	context.subscriptions.push(previewMarkdownCommand);
	context.subscriptions.push(addToFavoritesCommand);
	context.subscriptions.push(removeFromFavoritesCommand);
	context.subscriptions.push(clearRecentCommand);
	context.subscriptions.push(onDidSaveDocument);
	context.subscriptions.push(onDidChangeDocument);
}

/**
 * Helper function to copy directory recursively
 */
function copyDirectory(source, target) {
	if (!fs.existsSync(target)) {
		fs.mkdirSync(target);
	}

	const files = fs.readdirSync(source);
	files.forEach(file => {
		const sourcePath = path.join(source, file);
		const targetPath = path.join(target, file);
		const stat = fs.statSync(sourcePath);

		if (stat.isDirectory()) {
			copyDirectory(sourcePath, targetPath);
		} else {
			fs.copyFileSync(sourcePath, targetPath);
		}
	});
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
