#!/usr/bin/env node

/**
 * Version Generation Script
 * 
 * Generates a version.ts file containing build metadata:
 * - Semantic version from package.json
 * - Git branch name
 * - Git commit hash
 * - Build UTC date/time
 * 
 * This file is auto-generated at build time and should not be edited manually.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getGitInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    const commit = execSync('git rev-parse --short HEAD', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    return { branch, commit };
  } catch (error) {
    console.warn('Warning: Could not get git information:', error.message);
    return { 
      branch: 'unknown', 
      commit: 'unknown' 
    };
  }
}

function generateVersionFile() {
  try {
    // Read package.json for version
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    // Get git information
    const { branch, commit } = getGitInfo();

    // Generate build timestamp
    const buildDate = new Date().toISOString();

    // Create version object
    const versionInfo = {
      version,
      branch,
      commit,
      buildDate,
      displayVersion: `v${version}-${branch}`,
      fullDisplayText: `v${version}-${branch} (${commit})`
    };

    // Generate TypeScript file content
    const versionFileContent = `/**
 * Build Version Information
 * 
 * This file is auto-generated at build time.
 * Do not edit manually - changes will be overwritten.
 * 
 * Generated on: ${buildDate}
 */

export interface VersionInfo {
  version: string;
  branch: string;
  commit: string;
  buildDate: string;
  displayVersion: string;
  fullDisplayText: string;
}

export const versionInfo: VersionInfo = ${JSON.stringify(versionInfo, null, 2)};

export default versionInfo;
`;

    // Ensure the target directory exists
    const targetDir = join(__dirname, '..', 'client', 'src');
    mkdirSync(targetDir, { recursive: true });

    // Write version file
    const versionFilePath = join(targetDir, 'version.ts');
    writeFileSync(versionFilePath, versionFileContent, 'utf8');

    console.log('✅ Version file generated successfully:');
    console.log(`   Version: ${versionInfo.displayVersion}`);
    console.log(`   Commit: ${commit}`);
    console.log(`   Built: ${buildDate}`);
    console.log(`   File: ${versionFilePath}`);

  } catch (error) {
    console.error('❌ Error generating version file:', error.message);
    process.exit(1);
  }
}

// Run the script
generateVersionFile();