import archiver from 'archiver';
import yauzl from 'yauzl';
import { Readable } from 'stream';
import { storage } from './storage';
import type { Response } from 'express';

export interface BackupManifest {
  version: string;
  timestamp: string;
  schemaVersion: string;
  totalRecords: number;
  tables: {
    mowers: number;
    serviceRecords: number;
    attachments: number;
    tasks: number;
    components: number;
    parts: number;
    assetParts: number;
  };
}

export interface BackupData {
  mowers: any[];
  serviceRecords: any[];
  attachments: any[];
  tasks: any[];
  components: any[];
  parts: any[];
  assetParts: any[];
}

export async function createBackup(res: Response): Promise<void> {
  try {
    console.log('Starting backup creation...');
    
    // Set response headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="mower-manager-backup-${new Date().toISOString().split('T')[0]}.zip"`);

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create backup archive' });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Fetch all data from storage
    console.log('Fetching data from storage...');
    const [
      mowers,
      serviceRecords, 
      attachments,
      tasks,
      components,
      parts,
      assetParts
    ] = await Promise.all([
      storage.getAllMowers(),
      storage.getAllServiceRecords(), 
      storage.getAllAttachments(),
      storage.getAllTasks(),
      storage.getAllComponents(),
      storage.getAllParts(),
      storage.getAllAssetParts()
    ]);

    console.log('Data fetched:', {
      mowers: mowers.length,
      serviceRecords: serviceRecords.length,
      attachments: attachments.length,
      tasks: tasks.length,
      components: components.length,
      parts: parts.length,
      assetParts: assetParts.length
    });

    // Create backup data object
    const backupData: BackupData = {
      mowers,
      serviceRecords,
      attachments: attachments.map(att => ({ ...att, fileData: undefined })), // Exclude file data from JSON
      tasks,
      components,
      parts,
      assetParts
    };

    // Create manifest
    const manifest: BackupManifest = {
      version: '1.3.4',
      timestamp: new Date().toISOString(),
      schemaVersion: '1.3.4',
      totalRecords: mowers.length + serviceRecords.length + attachments.length + tasks.length + components.length + parts.length + assetParts.length,
      tables: {
        mowers: mowers.length,
        serviceRecords: serviceRecords.length,
        attachments: attachments.length,
        tasks: tasks.length,
        components: components.length,
        parts: parts.length,
        assetParts: assetParts.length
      }
    };

    // Add manifest to archive
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add database dump to archive
    archive.append(JSON.stringify(backupData, null, 2), { name: 'database.json' });

    // Add attachment files to archive
    console.log('Adding attachment files to archive...');
    for (const attachment of attachments) {
      if (attachment.fileData) {
        try {
          // Convert base64 to buffer
          const fileBuffer = Buffer.from(attachment.fileData, 'base64');
          
          // Determine folder based on what the attachment belongs to
          let folderPath = 'attachments/orphaned';
          if (attachment.mowerId) {
            folderPath = `attachments/mowers/${attachment.mowerId}`;
          } else if (attachment.componentId) {
            folderPath = `attachments/components/${attachment.componentId}`;
          } else if (attachment.partId) {
            folderPath = `attachments/parts/${attachment.partId}`;
          }

          // Add file to archive with proper path
          archive.append(fileBuffer, { 
            name: `${folderPath}/${attachment.id}_${attachment.fileName}` 
          });
        } catch (error) {
          console.warn(`Failed to add attachment ${attachment.id} to backup:`, error);
        }
      }
    }

    console.log('Finalizing archive...');
    // Finalize the archive
    await archive.finalize();
    
    console.log('Backup creation completed successfully');
  } catch (error) {
    console.error('Backup creation failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to create backup', 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

export async function validateBackupFile(buffer: Buffer): Promise<{valid: boolean, manifest?: BackupManifest, error?: string}> {
  try {
    // For now, we'll do a basic validation
    // In a real implementation, you'd use a ZIP parsing library to validate structure
    if (buffer.length < 100) {
      return { valid: false, error: 'File too small to be a valid backup' };
    }

    // Check if it starts with ZIP signature
    const zipSignature = buffer.subarray(0, 4);
    if (zipSignature[0] !== 0x50 || zipSignature[1] !== 0x4B) {
      return { valid: false, error: 'Not a valid ZIP file' };
    }

    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown validation error' 
    };
  }
}

export async function restoreFromBackup(buffer: Buffer): Promise<{success: boolean, stats?: any, error?: string}> {
  return new Promise((resolve) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, async (err, zipfile) => {
      if (err) {
        return resolve({ success: false, error: `Failed to read ZIP file: ${err.message}` });
      }

      if (!zipfile) {
        return resolve({ success: false, error: 'Invalid ZIP file' });
      }

      let manifest: BackupManifest | null = null;
      let backupData: BackupData | null = null;
      const attachmentFiles: Map<string, Buffer> = new Map();

      try {
        // Process each entry in the ZIP
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry, skip
            zipfile.readEntry();
          } else {
            // File entry
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                console.error('Error reading entry:', entry.fileName, err);
                zipfile.readEntry();
                return;
              }

              const chunks: Buffer[] = [];
              readStream!.on('data', (chunk) => chunks.push(chunk));
              readStream!.on('end', () => {
                const fileBuffer = Buffer.concat(chunks);
                
                if (entry.fileName === 'manifest.json') {
                  try {
                    manifest = JSON.parse(fileBuffer.toString('utf8'));
                  } catch (e) {
                    console.error('Failed to parse manifest.json:', e);
                  }
                } else if (entry.fileName === 'database.json') {
                  try {
                    backupData = JSON.parse(fileBuffer.toString('utf8'));
                  } catch (e) {
                    console.error('Failed to parse database.json:', e);
                  }
                } else if (entry.fileName.startsWith('attachments/')) {
                  // Store attachment files for later processing
                  attachmentFiles.set(entry.fileName, fileBuffer);
                }
                
                zipfile.readEntry();
              });
            });
          }
        });

        zipfile.on('end', async () => {
          try {
            // Validate we have required files
            if (!manifest) {
              return resolve({ success: false, error: 'No manifest.json found in backup' });
            }
            
            if (!backupData) {
              return resolve({ success: false, error: 'No database.json found in backup' });
            }

            console.log('Starting restore process...');
            console.log('Manifest:', manifest);
            
            // Begin restoration - this is a simplified implementation
            // In a production environment, you would want transactions and better error handling
            
            let totalRestored = 0;
            
            // Restore data in order of dependencies
            
            // 1. Restore mowers first (no dependencies)
            if (backupData.mowers && backupData.mowers.length > 0) {
              console.log(`Restoring ${backupData.mowers.length} mowers...`);
              for (const mowerData of backupData.mowers) {
                try {
                  await storage.createMower(mowerData);
                  totalRestored++;
                } catch (error) {
                  console.warn('Failed to restore mower:', error);
                }
              }
            }

            // 2. Restore parts (no dependencies)
            if (backupData.parts && backupData.parts.length > 0) {
              console.log(`Restoring ${backupData.parts.length} parts...`);
              for (const partData of backupData.parts) {
                try {
                  await storage.createPart(partData);
                  totalRestored++;
                } catch (error) {
                  console.warn('Failed to restore part:', error);
                }
              }
            }

            // 3. Restore components (depends on mowers)
            if (backupData.components && backupData.components.length > 0) {
              console.log(`Restoring ${backupData.components.length} components...`);
              for (const componentData of backupData.components) {
                try {
                  await storage.createComponent(componentData);
                  totalRestored++;
                } catch (error) {
                  console.warn('Failed to restore component:', error);
                }
              }
            }

            // 4. Restore tasks (depends on mowers)
            if (backupData.tasks && backupData.tasks.length > 0) {
              console.log(`Restoring ${backupData.tasks.length} tasks...`);
              for (const taskData of backupData.tasks) {
                try {
                  await storage.createTask(taskData);
                  totalRestored++;
                } catch (error) {
                  console.warn('Failed to restore task:', error);
                }
              }
            }

            // 5. Restore service records (depends on mowers)
            // Note: This is simplified - in production you'd need to handle the special creation method
            
            // 6. Restore attachments with file data
            if (backupData.attachments && backupData.attachments.length > 0) {
              console.log(`Restoring ${backupData.attachments.length} attachments...`);
              for (const attachmentData of backupData.attachments) {
                try {
                  // Find the corresponding file data
                  let fileData = '';
                  for (const [fileName, fileBuffer] of Array.from(attachmentFiles.entries())) {
                    if (fileName.includes(attachmentData.id)) {
                      fileData = fileBuffer.toString('base64');
                      break;
                    }
                  }
                  
                  if (fileData) {
                    await storage.createAttachment({
                      ...attachmentData,
                      fileData
                    });
                    totalRestored++;
                  } else {
                    console.warn(`No file data found for attachment ${attachmentData.id}`);
                  }
                } catch (error) {
                  console.warn('Failed to restore attachment:', error);
                }
              }
            }

            // 7. Restore asset parts (depends on parts, mowers, components)
            if (backupData.assetParts && backupData.assetParts.length > 0) {
              console.log(`Restoring ${backupData.assetParts.length} asset parts...`);
              for (const assetPartData of backupData.assetParts) {
                try {
                  await storage.createAssetPart(assetPartData);
                  totalRestored++;
                } catch (error) {
                  console.warn('Failed to restore asset part:', error);
                }
              }
            }

            console.log(`Restore completed! Restored ${totalRestored} records.`);
            
            resolve({ 
              success: true, 
              stats: { 
                totalRecords: totalRestored,
                manifest: manifest 
              } 
            });
          } catch (error) {
            console.error('Restore process failed:', error);
            resolve({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown restore error' 
            });
          }
        });

        zipfile.on('error', (err) => {
          resolve({ success: false, error: `ZIP processing error: ${err.message}` });
        });

      } catch (error) {
        resolve({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error during restore' 
        });
      }
    });
  });
}