import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PDFInfo {
  pageCount: number;
  thumbnailBuffer?: Buffer;
}

export interface TxtThumbnailInfo {
  thumbnailBuffer: Buffer;
}

/**
 * Generate a text-based thumbnail for TXT files
 */
export async function generateTxtThumbnail(fileBuffer: Buffer): Promise<TxtThumbnailInfo> {
  try {
    // Dynamically import canvas to avoid initialization issues
    const { createCanvas } = await import('canvas');
    
    // Get text content
    const textContent = fileBuffer.toString('utf-8');
    const lines = textContent.split('\n').slice(0, 10); // First 10 lines
    
    // Create canvas for text rendering
    const canvas = createCanvas(200, 300);
    const ctx = canvas.getContext('2d');
    
    // Set background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 300);
    
    // Set text properties
    ctx.fillStyle = '#333333';
    ctx.font = '10px monospace';
    
    // Add file type indicator
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('TXT', 10, 20);
    
    // Draw text lines
    ctx.fillStyle = '#333333';
    ctx.font = '8px monospace';
    
    let y = 40;
    for (const line of lines) {
      if (y > 280) break; // Don't exceed canvas height
      
      // Truncate long lines
      const truncatedLine = line.length > 25 ? line.substring(0, 25) + '...' : line;
      ctx.fillText(truncatedLine, 10, y);
      y += 12;
    }
    
    // Add border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 200, 300);
    
    // Convert to buffer
    const thumbnailBuffer = canvas.toBuffer('image/png');
    
    return {
      thumbnailBuffer
    };
  } catch (error) {
    console.error('Error generating TXT thumbnail:', error);
    throw new Error('Failed to generate TXT thumbnail');
  }
}

/**
 * Extract PDF page count using GraphicsMagick
 */
async function getPDFPageCountWithGM(tempPdfPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`gm identify -format '%n\n' "${tempPdfPath}"`);
    const pageCount = parseInt(stdout.trim());
    if (isNaN(pageCount) || pageCount <= 0) {
      throw new Error('Invalid page count from GraphicsMagick');
    }
    console.log('✓ Got page count from GraphicsMagick:', pageCount);
    return pageCount;
  } catch (error) {
    console.warn('⚠ GraphicsMagick page count failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Extract PDF page count using ImageMagick
 */
async function getPDFPageCountWithIM(tempPdfPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`identify -format '%n\n' "${tempPdfPath}"`);
    const pageCount = parseInt(stdout.trim());
    if (isNaN(pageCount) || pageCount <= 0) {
      throw new Error('Invalid page count from ImageMagick');
    }
    console.log('✓ Got page count from ImageMagick:', pageCount);
    return pageCount;
  } catch (error) {
    console.warn('⚠ ImageMagick page count failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Extract PDF page count with multiple fallback methods
 */
async function extractPDFPageCount(fileBuffer: Buffer): Promise<number> {
  let pageCount = 1; // Default to 1 page if all methods fail
  
  // Method 1: Try pdf-parse library first
  try {
    const pdf = await import('pdf-parse');
    const pdfParse = pdf.default;
    const pdfData = await pdfParse(fileBuffer);
    pageCount = pdfData.numpages;
    console.log('✓ Got page count from pdf-parse:', pageCount);
    return pageCount;
  } catch (parseError) {
    console.warn('⚠ pdf-parse failed:', parseError instanceof Error ? parseError.message : String(parseError));
  }
  
  // Method 2 & 3: Try GraphicsMagick/ImageMagick if pdf-parse fails
  const tempDir = tmpdir();
  const tempPdfPath = path.join(tempDir, `temp_pdf_pagecount_${Date.now()}.pdf`);
  
  try {
    // Write PDF buffer to temporary file for external tools
    fs.writeFileSync(tempPdfPath, fileBuffer);
    console.log('📄 Wrote PDF to temp file for page count extraction:', tempPdfPath);
    
    // Try GraphicsMagick first (it's often more reliable for PDFs)
    try {
      pageCount = await getPDFPageCountWithGM(tempPdfPath);
      return pageCount;
    } catch (gmError) {
      console.warn('GraphicsMagick failed, trying ImageMagick...');
    }
    
    // Try ImageMagick as fallback
    try {
      pageCount = await getPDFPageCountWithIM(tempPdfPath);
      return pageCount;
    } catch (imError) {
      console.warn('ImageMagick also failed, using default page count of 1');
    }
    
  } catch (fileError) {
    console.warn('Failed to write temp file for page count extraction:', fileError);
  } finally {
    // Clean up temporary file
    try {
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
        console.log('🧹 Cleaned up temp PDF file for page count');
      }
    } catch (cleanupError) {
      console.warn('Failed to clean up temp PDF file:', cleanupError);
    }
  }
  
  console.warn('⚠ All PDF page count methods failed, defaulting to 1 page');
  return pageCount;
}
/**
 * Extract PDF information including page count and generate thumbnail
 */
export async function processPDF(fileBuffer: Buffer): Promise<PDFInfo> {
  try {
    // Generate thumbnail of first page
    let thumbnailBuffer: Buffer | undefined;
    
    // Extract page count using multiple fallback methods
    const pageCount = await extractPDFPageCount(fileBuffer);
    
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
      console.error('Thumbnail error stack:', thumbnailError instanceof Error ? thumbnailError.stack : String(thumbnailError));
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