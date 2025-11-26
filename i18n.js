const vscode = require('vscode');

// 语言包
const translations = {
	'zh-cn': {
		// 视图名称
		'view.explorer': '文件浏览器',
		'view.favorites': '快速访问',
		'view.recent': '最近打开',
		'view.hidden': '隐藏',
		
		// 命令标题
		'command.addFolder': '添加文件夹',
		'command.refresh': '刷新',
		'command.openFile': '打开文件',
		'command.hideItem': '隐藏',
		'command.showItem': '显示',
		'command.renameItem': '重命名',
		'command.deleteItem': '删除',
		'command.copyItem': '复制',
		'command.cutItem': '剪切',
		'command.pasteItem': '粘贴',
		'command.newFile': '新建文件',
		'command.newFolder': '新建文件夹',
		'command.search': '搜索',
		'command.clearSearch': '清除搜索',
		'command.previewMarkdown': '预览 Markdown',
		'command.addToFavorites': '添加到收藏',
		'command.removeFromFavorites': '移除收藏',
		'command.clearRecent': '清除最近打开',
		
		// 提示信息
		'msg.folderAdded': '已添加文件夹: {0}',
		'msg.itemHidden': '已隐藏: {0}',
		'msg.itemShown': '已显示: {0}',
		'msg.itemRenamed': '已重命名: {0} -> {1}',
		'msg.itemDeleted': '已删除: {0}',
		'msg.itemCopied': '已复制: {0}',
		'msg.itemCut': '已剪切: {0}',
		'msg.itemMoved': '已移动: {0}',
		'msg.itemPasted': '已粘贴: {0}',
		'msg.folderCreated': '已创建文件夹: {0}',
		'msg.searchCleared': '已清除搜索',
		'msg.addedToFavorites': '已添加到收藏: {0}',
		'msg.removedFromFavorites': '已移除收藏: {0}',
		'msg.recentCleared': '已清除最近打开列表',
		
		// 警告信息
		'warn.targetExists': '目标位置已存在同名项目: {0}',
		'warn.cannotMoveToSelf': '无法将文件夹移动到自身内部',
		'warn.clipboardEmpty': '剪贴板为空',
		'warn.targetDirNotExists': '目标目录不存在',
		'warn.selectDirFirst': '请先选择一个目录',
		'warn.onlyMarkdownPreview': '只能预览 Markdown 文件',
		
		// 错误信息
		'error.renameFailed': '重命名失败: {0}',
		'error.deleteFailed': '删除失败: {0}',
		'error.moveFailed': '移动失败: {0}',
		'error.pasteFailed': '粘贴失败: {0}',
		'error.createFileFailed': '创建文件失败: {0}',
		'error.createFolderFailed': '创建文件夹失败: {0}',
		'error.previewFailed': '预览失败: {0}',
		
		// 输入框
		'input.selectFolder': '选择文件夹',
		'input.enterNewName': '输入新名称',
		'input.enterFileName': '输入文件名',
		'input.enterFolderName': '输入文件夹名',
		'input.searchPlaceholder': '输入搜索关键词...',
		'input.searchPrompt': '搜索文件和文件夹(实时更新)',
		
		// 验证信息
		'validate.nameEmpty': '名称不能为空',
		'validate.nameNoSeparator': '名称不能包含路径分隔符',
		'validate.fileNameEmpty': '文件名不能为空',
		'validate.fileNameNoSeparator': '文件名不能包含路径分隔符',
		'validate.folderNameEmpty': '文件夹名不能为空',
		'validate.folderNameNoSeparator': '文件夹名不能包含路径分隔符',
		
		// 确认对话框
		'confirm.delete': '确定要删除 "{0}" 吗?',
		'confirm.deleteButton': '删除'
	},
	'en': {
		// 视图名称
		'view.explorer': 'File Explorer',
		'view.favorites': 'Favorites',
		'view.recent': 'Recent Files',
		'view.hidden': 'Hidden',
		
		// 命令标题
		'command.addFolder': 'Add Folder',
		'command.refresh': 'Refresh',
		'command.openFile': 'Open File',
		'command.hideItem': 'Hide',
		'command.showItem': 'Show',
		'command.renameItem': 'Rename',
		'command.deleteItem': 'Delete',
		'command.copyItem': 'Copy',
		'command.cutItem': 'Cut',
		'command.pasteItem': 'Paste',
		'command.newFile': 'New File',
		'command.newFolder': 'New Folder',
		'command.search': 'Search',
		'command.clearSearch': 'Clear Search',
		'command.previewMarkdown': 'Preview Markdown',
		'command.addToFavorites': 'Add to Favorites',
		'command.removeFromFavorites': 'Remove from Favorites',
		'command.clearRecent': 'Clear Recent Files',
		
		// 提示信息
		'msg.folderAdded': 'Folder added: {0}',
		'msg.itemHidden': 'Hidden: {0}',
		'msg.itemShown': 'Shown: {0}',
		'msg.itemRenamed': 'Renamed: {0} -> {1}',
		'msg.itemDeleted': 'Deleted: {0}',
		'msg.itemCopied': 'Copied: {0}',
		'msg.itemCut': 'Cut: {0}',
		'msg.itemMoved': 'Moved: {0}',
		'msg.itemPasted': 'Pasted: {0}',
		'msg.folderCreated': 'Folder created: {0}',
		'msg.searchCleared': 'Search cleared',
		'msg.addedToFavorites': 'Added to favorites: {0}',
		'msg.removedFromFavorites': 'Removed from favorites: {0}',
		'msg.recentCleared': 'Recent files list cleared',
		
		// 警告信息
		'warn.targetExists': 'Target already exists: {0}',
		'warn.cannotMoveToSelf': 'Cannot move folder into itself',
		'warn.clipboardEmpty': 'Clipboard is empty',
		'warn.targetDirNotExists': 'Target directory does not exist',
		'warn.selectDirFirst': 'Please select a directory first',
		'warn.onlyMarkdownPreview': 'Can only preview Markdown files',
		
		// 错误信息
		'error.renameFailed': 'Rename failed: {0}',
		'error.deleteFailed': 'Delete failed: {0}',
		'error.moveFailed': 'Move failed: {0}',
		'error.pasteFailed': 'Paste failed: {0}',
		'error.createFileFailed': 'Create file failed: {0}',
		'error.createFolderFailed': 'Create folder failed: {0}',
		'error.previewFailed': 'Preview failed: {0}',
		
		// 输入框
		'input.selectFolder': 'Select Folder',
		'input.enterNewName': 'Enter new name',
		'input.enterFileName': 'Enter file name',
		'input.enterFolderName': 'Enter folder name',
		'input.searchPlaceholder': 'Enter search keyword...',
		'input.searchPrompt': 'Search files and folders (real-time)',
		
		// 验证信息
		'validate.nameEmpty': 'Name cannot be empty',
		'validate.nameNoSeparator': 'Name cannot contain path separators',
		'validate.fileNameEmpty': 'File name cannot be empty',
		'validate.fileNameNoSeparator': 'File name cannot contain path separators',
		'validate.folderNameEmpty': 'Folder name cannot be empty',
		'validate.folderNameNoSeparator': 'Folder name cannot contain path separators',
		
		// 确认对话框
		'confirm.delete': 'Are you sure you want to delete "{0}"?',
		'confirm.deleteButton': 'Delete'
	}
};

/**
 * 获取当前语言
 */
function getCurrentLanguage() {
	const locale = vscode.env.language.toLowerCase();
	// 支持的语言: zh-cn, en
	if (locale.startsWith('zh')) {
		return 'zh-cn';
	}
	return 'en';
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {...string} args - 格式化参数
 * @returns {string} 翻译后的文本
 */
function t(key, ...args) {
	const language = getCurrentLanguage();
	const languagepack = translations[language] || translations['en'];
	let text = languagepack[key] || key;
	
	// 格式化文本: 替换 {0}, {1}, {2} 等
	args.forEach((arg, index) => {
		text = text.replace(`{${index}}`, arg);
	});
	
	return text;
}

module.exports = {
	t,
	getCurrentLanguage
};


