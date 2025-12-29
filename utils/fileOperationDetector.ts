/**
 * Comprehensive File Operation Detection Library
 * 
 * Production-ready keyword library for detecting file operations in user requests.
 * Handles all variations and edge cases for agentic file management.
 */

// Comprehensive keyword sets for different operations
const FILE_OPERATION_KEYWORDS = {
    // Creation keywords
    create: [
        'create', 'make', 'generate', 'build', 'write', 'compose', 'draft',
        'develop', 'construct', 'produce', 'add', 'new', 'initialize', 'setup'
    ],

    // Modification keywords
    modify: [
        'modify', 'edit', 'change', 'update', 'alter', 'revise', 'adjust',
        'tweak', 'refactor', 'improve', 'fix', 'correct', 'amend', 'rewrite'
    ],

    // Deletion keywords (for future use)
    delete: [
        'delete', 'remove', 'erase', 'clear', 'destroy', 'eliminate'
    ],

    // Packaging keywords
    package: [
        'package', 'bundle', 'compress', 'zip', 'archive', 'combine', 'merge'
    ],

    // Delivery keywords
    deliver: [
        'deliverable', 'deliver', 'provide', 'give', 'supply', 'output',
        'export', 'save', 'store', 'name', 'named', 'call', 'as'
    ],

    // Reference keywords (when mentioning existing files)
    reference: [
        'the file', 'this file', 'that file', 'file', 'script', 'code',
        'document', 'in', 'to', 'for'
    ]
};

// All supported file extensions
const FILE_EXTENSIONS = [
    'py', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json',
    'txt', 'md', 'zip', 'tar', 'gz', 'pdf', 'csv', 'xml',
    'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'swift',
    'kt', 'sql', 'sh', 'yaml', 'yml', 'toml', 'ini'
];

/**
 * Detect if user request involves a file operation
 * @param userText - The user's request text
 * @returns Object with detection results
 */
export function detectFileOperation(userText: string): {
    isFileOperation: boolean;
    fileName: string | null;
    operationType: 'create' | 'modify' | 'delete' | 'package' | null;
    confidence: number;
} {
    const lowerText = userText.toLowerCase();

    // Build comprehensive regex from keyword library
    const allKeywords = [
        ...FILE_OPERATION_KEYWORDS.create,
        ...FILE_OPERATION_KEYWORDS.modify,
        ...FILE_OPERATION_KEYWORDS.delete,
        ...FILE_OPERATION_KEYWORDS.package,
        ...FILE_OPERATION_KEYWORDS.deliver,
        ...FILE_OPERATION_KEYWORDS.reference
    ];

    // Match: [keyword]...filename.ext
    const extensionPattern = FILE_EXTENSIONS.join('|');
    const keywordPattern = allKeywords.join('|');
    const regex = new RegExp(
        `(?:${keywordPattern}).*?([a-zA-Z0-9_-]+\\.(${extensionPattern}))`,
        'i'
    );

    const match = lowerText.match(regex);

    if (!match) {
        return {
            isFileOperation: false,
            fileName: null,
            operationType: null,
            confidence: 0
        };
    }

    const fileName = match[1];

    // Determine operation type based on keywords found
    let operationType: 'create' | 'modify' | 'delete' | 'package' | null = null;
    let confidence = 0.5; // Base confidence

    // Check for package operations first (highest specificity)
    if (FILE_OPERATION_KEYWORDS.package.some(kw => lowerText.includes(kw))) {
        operationType = 'package';
        confidence = 0.9;
    }
    // Then check for modifications
    else if (FILE_OPERATION_KEYWORDS.modify.some(kw => lowerText.includes(kw))) {
        operationType = 'modify';
        confidence = 0.85;
    }
    // Then check for deletions
    else if (FILE_OPERATION_KEYWORDS.delete.some(kw => lowerText.includes(kw))) {
        operationType = 'delete';
        confidence = 0.9;
    }
    // Default to create
    else if (FILE_OPERATION_KEYWORDS.create.some(kw => lowerText.includes(kw))) {
        operationType = 'create';
        confidence = 0.8;
    }
    // If only delivery/reference keywords, still create
    else {
        operationType = 'create';
        confidence = 0.6;
    }

    // Boost confidence if explicit filename is mentioned
    if (lowerText.includes(fileName)) {
        confidence = Math.min(confidence + 0.15, 1.0);
    }

    return {
        isFileOperation: true,
        fileName,
        operationType,
        confidence
    };
}

/**
 * Get appropriate acknowledgment message for file operation
 * @param fileName - The detected filename
 * @param operationType - The type of operation
 * @returns Acknowledgment message
 */
export function getFileOperationAck(
    fileName: string,
    operationType: 'create' | 'modify' | 'delete' | 'package' | null
): string {
    switch (operationType) {
        case 'create':
            return `I'll create ${fileName} for you.`;
        case 'modify':
            return `I'll modify ${fileName} as requested.`;
        case 'delete':
            return `I'll remove ${fileName}.`;
        case 'package':
            return `I'll package the files into ${fileName}.`;
        default:
            return `I'll work on ${fileName} for you.`;
    }
}
