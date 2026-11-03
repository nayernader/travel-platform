import { BadRequestException, Injectable } from '@nestjs/common';
import { openSync, readSync, closeSync, unlinkSync } from 'fs';

const isPng = (b: Buffer) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isJpg = (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

@Injectable()
export class UploadsService {
  private head(path: string) {
    const fd = openSync(path, 'r'); const buf = Buffer.alloc(8);
    try { readSync(fd, buf, 0, 8, 0); } finally { closeSync(fd); }
    return buf;
  }

  /**
   * Checks the real file signature (a renamed .txt is rejected), deletes bad files,
   * and returns the public URLs. Other modules call this and store the URLs.
   */
  processImages(files: Express.Multer.File[]): string[] {
    if (!files?.length) throw new BadRequestException('No image received');
    const bad = files.filter((f) => { const h = this.head(f.path); return !(isPng(h) || isJpg(h)); });
    if (bad.length) {
      files.forEach((f) => { try { unlinkSync(f.path); } catch { /* ignore */ } });   // remove everything of this request
      throw new BadRequestException('One of the files is not a real JPG or PNG image');
    }
    return files.map((f) => `/uploads/${f.filename}`);
  }
}