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
    // Generate thumbnail of first page
    let thumbnailBuffer: Buffer | undefined;
    let pageCount = 1; // Default to 1 page if we can't parse
    
    // Try to get page count with pdf-parse, but don't fail if it doesn't work
    try {
      // Dynamically import pdf-parse to avoid initialization issues
      const pdf = await import('pdf-parse');
      const pdfParse = pdf.default;
      
      // Parse PDF to get page count
      const pdfData = await pdfParse(fileBuffer);
      pageCount = pdfData.numpages;
      console.log('✓ Got page count from pdf-parse:', pageCount);
    } catch (parseError) {
      console.warn('⚠ pdf-parse failed, using default page count of 1:', parseError.message);
      // Continue with default pageCount = 1
    }
    
    try {
      // Dynamically import pdf2pic to avoid initialization issues
      const pdf2picModule = await import('pdf2pic');
      const pdf2pic = pdf2picModule.default;
      
      // Create temporary file for pdf2pic processing
      const tempDir = tmpdir();
      const tempPdfPath = path.join(tempDir, `temp_pdf_${Date.now()}.pdf`);
      
      console.log('📄 Writing PDF to temp file:', tempPdfPath);
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
      
      console.log('🖼️ Converting PDF page to image...');
      // Convert first page to image - try without responseType first
      const result = await convert(1);
      
      console.log('📊 pdf2pic result:', {
        hasResult: !!result,
        resultType: typeof result,
        resultKeys: result ? Object.keys(result) : [],
        hasBuffer: result && 'buffer' in result,
        hasPath: result && 'path' in result,
      });
      
      // If we got a file path, read it as buffer
      if (result && 'path' in result && result.path) {
        try {
          const imageBuffer = fs.readFileSync(result.path);
          thumbnailBuffer = imageBuffer;
          console.log('✓ Read thumbnail from path:', result.path, 'size:', imageBuffer.length);
          
          // Clean up the generated image file
          try {
            fs.unlinkSync(result.path);
            console.log('🧹 Cleaned up generated image file');
          } catch (cleanupError) {
            console.warn('Failed to clean up generated image file:', cleanupError);
          }
        } catch (readError) {
          console.warn('Failed to read generated image file:', readError);
        }
      } else if (result && 'buffer' in result) {
        thumbnailBuffer = result.buffer as Buffer;
        console.log('✓ Thumbnail buffer size:', thumbnailBuffer.length);
      } else {
        console.warn('⚠ Unexpected pdf2pic result format');
      }
      
      // Clean up temporary PDF file
      try {
        fs.unlinkSync(tempPdfPath);
        console.log('🧹 Cleaned up temp file');
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary PDF file:', cleanupError);
      }
      
    } catch (thumbnailError) {
      console.warn('Failed to generate PDF thumbnail:', thumbnailError);
      console.error('Thumbnail error stack:', thumbnailError.stack);
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