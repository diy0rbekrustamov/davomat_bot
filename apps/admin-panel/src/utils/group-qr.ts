export interface QrGroup { nomi: string; qrCodeImageUrl?: string | null }

// The same A4 layout is used for individual images and the bulk archive.
export function renderGroupQr(group: QrGroup): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!group.qrCodeImageUrl) return reject(new Error(`${group.nomi}: QR rasm mavjud emas`));
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('QR rasmni tayyorlab bo‘lmadi'));
    const img = new Image();
    const timer = window.setTimeout(() => { img.src = ''; reject(new Error(`${group.nomi}: QR rasm yuklanmadi`)); }, 20000);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        const qrSize = 600;
        const qrY = (canvas.height - qrSize) / 2 - 100;
        ctx.drawImage(img, (canvas.width - qrSize) / 2, qrY, qrSize, qrSize);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 50px Arial';
        ctx.textAlign = 'center';
        const lines: string[] = [];
        let line = '';
        for (const word of `${group.nomi} !`.split(/\s+/)) {
          if (line && ctx.measureText(`${line} ${word}`).width > canvas.width - 200) {
            lines.push(line); line = '';
          }
          for (const letter of (line ? ' ' : '') + word) {
            if (ctx.measureText(line + letter).width > canvas.width - 200) { lines.push(line); line = ''; }
            line += letter;
          }
        }
        if (line) lines.push(line);
        lines.forEach((text, index) => ctx.fillText(text.trim(), canvas.width / 2, qrY + qrSize + 120 + index * 70));
        resolve(canvas.toDataURL('image/png'));
      } catch { reject(new Error(`${group.nomi}: QR rasmni tayyorlab bo‘lmadi`)); }
    };
    img.onerror = () => { window.clearTimeout(timer); reject(new Error(`${group.nomi}: QR rasm yuklanmadi`)); };
    img.src = group.qrCodeImageUrl;
  });
}

export function qrFileName(name: string, used: Set<string>): string {
  let stem = name.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 150) || 'Guruh';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = '_' + stem;
  let file = `${stem}.png`;
  for (let suffix = 2; used.has(file.toLocaleLowerCase()); suffix++) file = `${stem} (${suffix}).png`;
  used.add(file.toLocaleLowerCase());
  return file;
}

export async function createGroupQrZip(groups: QrGroup[], progress: (count: number) => void): Promise<string> {
  if (!groups.length) throw new Error('Guruhlar mavjud emas');
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const names = new Set<string>();
  for (let index = 0; index < groups.length; index++) {
    const image = await renderGroupQr(groups[index]);
    zip.file(qrFileName(groups[index].nomi, names), image.split(',')[1], { base64: true });
    progress(index + 1);
  }
  const result = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 3 } });
  if (result.length > 28 * 1024 * 1024) throw new Error('ZIP hajmi juda katta (21 MB dan oshmasligi kerak)');
  return result;
}
