#!/usr/bin/env node
/**
 * Update index.html to add a new subject (PPL, CPL, ATPL, IR, etc.)
 *
 * Automatically detects the exam type from the JSON filename and:
 * 1. Adds the appropriate cplAcNum/atplAcNum/irAcNum property to CONFIG.subjectMapping
 * 2. Adds the JSON file entry to CONFIG.contentFiles for that exam type
 *
 * Usage: node update-index-for-subject.js <subject-number> <json-filename>
 * Examples:
 *   node update-index-for-subject.js 34 cpl-hf.json        # CPL Human Factors
 *   node update-index-for-subject.js 40 atpl-law.json      # ATPL Law
 *   node update-index-for-subject.js 50 ir-met.json        # IR Meteorology
 */

const fs = require('fs');
const path = require('path');

// Get arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node update-index-for-subject.js <subject-number> <json-filename>');
    console.error('');
    console.error('Examples:');
    console.error('  node update-index-for-subject.js 34 cpl-hf.json');
    console.error('  node update-index-for-subject.js 40 atpl-law.json');
    console.error('  node update-index-for-subject.js 50 ir-met.json');
    process.exit(1);
}

const subjectNum = args[0];
const jsonFilename = args[1];

// Validate inputs
if (!/^\d+$/.test(subjectNum)) {
    console.error('❌ ERROR: Subject number must be numeric');
    process.exit(1);
}

if (!jsonFilename.endsWith('.json')) {
    console.error('❌ ERROR: Filename must end with .json');
    process.exit(1);
}

// Detect exam type from filename
let examType = null;
let examTypeProperty = null;
if (jsonFilename.startsWith('cpl-')) {
    examType = 'cpl';
    examTypeProperty = 'cplAcNum';
} else if (jsonFilename.startsWith('atpl-')) {
    examType = 'atpl';
    examTypeProperty = 'atplAcNum';
} else if (jsonFilename.startsWith('ir-')) {
    examType = 'ir';
    examTypeProperty = 'irAcNum';
} else if (jsonFilename.startsWith('ppl-')) {
    examType = 'ppl';
    examTypeProperty = 'pplAcNum';
} else {
    console.error(`❌ ERROR: Could not detect exam type from filename "${jsonFilename}"`);
    console.error('   Filename must start with: cpl-, atpl-, ir-, or ppl-');
    process.exit(1);
}

console.log(`Detected exam type: ${examType.toUpperCase()}`);

// Read index.html
const indexPath = path.join(__dirname, 'kdr-refresher', 'index.html');
if (!fs.existsSync(indexPath)) {
    console.error(`❌ ERROR: Could not find index.html at ${indexPath}`);
    process.exit(1);
}

let content = fs.readFileSync(indexPath, 'utf8');
const originalLength = content.length;

// Find the subject name mapping to get the entry
// Look for patterns like: 'subject-name': { num: 'XX', acNum: 'YY', prefix: 'ZZ' }
// We search by the acNum property which should be unique or use prefix as fallback
const subjectNameMatch = content.match(new RegExp(`'([^']+)':\\s*\\{\\s*num:\\s*'\\d+',\\s*acNum:\\s*'\\d+',\\s*prefix:\\s*'${subjectNum}'\\s*[,}]`));

if (!subjectNameMatch) {
    console.error(`❌ ERROR: Could not find a subject with prefix/acNum '${subjectNum}' in CONFIG.subjectMapping`);
    console.error('   The subject must already exist with a PPL mapping (num, acNum, prefix).');
    process.exit(1);
}

const subjectName = subjectNameMatch[1];
console.log(`Found subject: ${subjectName}`);

// EDIT 1: Add the exam type property (cplAcNum, atplAcNum, irAcNum, etc.) to the subject mapping
const searchPattern = new RegExp(
    `('${subjectName}':\\s*\\{\\s*num:\\s*'\\d+',\\s*acNum:\\s*'\\d+',\\s*prefix:\\s*'${subjectNum}')([^}]*)\\}`,
    'g'
);

let edit1Done = false;
content = content.replace(searchPattern, (match, p1, p2) => {
    if (!edit1Done) {
        edit1Done = true;
        // Check if property already exists
        if (p2.includes(`${examTypeProperty}:`)) {
            console.log(`⚠️  Property ${examTypeProperty} already exists, skipping replacement in mapping`);
            return match;
        }
        return `${p1}, ${examTypeProperty}: '${subjectNum}'${p2}}`;
    }
    return match;
});

if (!edit1Done) {
    console.error(`❌ ERROR: Could not apply Edit 1 (add ${examTypeProperty} to ${subjectName})`);
    process.exit(1);
}
console.log(`✓ Edit 1: Added ${examTypeProperty}: '${subjectNum}' to '${subjectName}'`);

// EDIT 2: Add entry to CONFIG.contentFiles[examType]
// Ensure the exam type section exists
if (!new RegExp(`'${examType}':\\s*\\{`).test(content)) {
    console.log(`⚠️  Creating new ${examType.toUpperCase()} section in CONFIG.contentFiles`);
    // Insert new exam type section before the closing brace of contentFiles
    const newSection = `'${examType}': {\n                    '${subjectNum}': 'data/${jsonFilename}'\n                },`;
    content = content.replace(
        /contentFiles:\s*\{/,
        `contentFiles: {\n                '${examType}': {\n                    '${subjectNum}': 'data/${jsonFilename}'\n                },`
    );
    console.log(`✓ Edit 2: Created ${examType.toUpperCase()} section with '${subjectNum}': 'data/${jsonFilename}'`);
} else {
    // Find the exam type section and add entry
    const examSectionMatch = content.match(new RegExp(`'${examType}':\\s*\\{([^}]*)\\}`));
    if (!examSectionMatch) {
        console.error(`❌ ERROR: Could not find CONFIG.contentFiles.${examType} section`);
        process.exit(1);
    }

    const examSection = examSectionMatch[0];

    // Check if entry already exists
    if (new RegExp(`'${subjectNum}':\\s*'data/${jsonFilename.replace(/\./g, '\\.')}'`).test(examSection)) {
        console.log(`⚠️  Entry for '${subjectNum}' already exists in ${examType.toUpperCase()} contentFiles`);
    } else {
        // Add after the last existing entry
        const updatedSection = examSection.replace(
            /(('[0-9]+':\s*'data\/[^']+')[,\s]*)\}/,
            `$1,\n                    '${subjectNum}': 'data/${jsonFilename}'\n                }`
        );

        if (updatedSection === examSection) {
            // Empty section or different format, try adding to empty object
            const updatedSection2 = examSection.replace(
                /\{\s*\}/,
                `{\n                    '${subjectNum}': 'data/${jsonFilename}'\n                }`
            );
            if (updatedSection2 !== examSection) {
                content = content.replace(examSection, updatedSection2);
            } else {
                console.error(`❌ ERROR: Could not parse ${examType.toUpperCase()} section format`);
                process.exit(1);
            }
        } else {
            content = content.replace(examSection, updatedSection);
        }
        console.log(`✓ Edit 2: Added '${subjectNum}': 'data/${jsonFilename}' to ${examType.toUpperCase()} contentFiles`);
    }
}

// Write updated content back
fs.writeFileSync(indexPath, content, 'utf8');
const newLength = content.length;

console.log(`\n✅ Successfully updated index.html (+${newLength - originalLength} bytes)`);
console.log(`   Subject: ${subjectName}`);
console.log(`   Exam Type: ${examType.toUpperCase()}`);
console.log(`   Subject Number: ${subjectNum}`);
console.log(`   JSON file: data/${jsonFilename}`);
console.log(`\nNext step: Upload the updated index.html to GitHub`);
