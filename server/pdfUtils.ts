import pdf from 'pdf-parse';
import pdf2pic from 'pdf2pic';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

export interface PDFInfo {
  pageCount: number;
  thumbnailBuffer?: Buffer;
}

/**
 * Extract PDF information including page count and generate thumbnail
 */
export async function processPDF(fileBuffer: Buffer): Promise<PDFInfo> {
  try {
    // Parse PDF to get page count
    const pdfData = await pdf(fileBuffer);
    const pageCount = pdfData.numpages;

    // Generate thumbnail of first page
    let thumbnailBuffer: Buffer | undefined;
    
    try {
      // Create temporary file for pdf2pic processing
      const tempDir = tmpdir();
      const tempPdfPath = path.join(tempDir, `temp_pdf_${Date.now()}.pdf`);
      
      // Write PDF buffer to temporary file
      fs.writeFileSync(tempPdfPath, fileBuffer);
      
      // Configure pdf2pic
      const convert = pdf2pic.fromPath(tempPdfPath, {
        density: 100, // DPI
        saveFilename: "page",
        savePath: tempDir,
        format: "png",
        width: 200, // Thumbnail width
        height: 300, // Thumbnail height
      });
      
      // Convert first page to image
      const result = await convert(1, { responseType: 'buffer' });
      
      if (result && 'buffer' in result) {
        thumbnailBuffer = result.buffer as Buffer;
      }
      
      // Clean up temporary PDF file
      try {
        fs.unlinkSync(tempPdfPath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary PDF file:', cleanupError);
      }
      
    } catch (thumbnailError) {
      console.warn('Failed to generate PDF thumbnail:', thumbnailError);
      // Continue without thumbnail
    }

    return {
      pageCount,
      thumbnailBuffer
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF');
  }
}

/**
 * Get page count for documents (simplified - just returns 1 for most document types)
 * In a real implementation, you might want to use different libraries for different document types
 */
export function getDocumentPageCount(fileBuffer: Buffer, fileName: string): number {
  // For now, we'll return 1 for most document types
  // This could be enhanced to actually parse different document formats
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'txt':
      // For text files, we could estimate pages based on content length
      const textContent = fileBuffer.toString('utf-8');
      const estimatedPages = Math.max(1, Math.ceil(textContent.length / 3000)); // ~3000 chars per page
      return estimatedPages;
    case 'doc':
    case 'docx':
    case 'rtf':
      // For Word documents, we'd need a specialized library to get accurate page count
      // For now, return 1 as a placeholder
      return 1;
    default:
      return 1;
  }
}